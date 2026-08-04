/**
 * Legacy LearnWorlds user importer.
 *
 * Reads a LearnWorlds user export CSV and migrates accounts onto this platform:
 * creates users (APPROVED, with NO password), enrols them into the mapped
 * courses they already held, and mints a single-use activation link for each new
 * account so they can set their own password. Nothing is emailed — the links are
 * written to a CSV for you to mail-merge.
 *
 * Safe by default: without --commit it only reads, and prints the exact same
 * report it would produce for a real run.
 *
 *   node prisma/import_legacy_users.mjs --file "C:/path/users-export.csv"
 *   node prisma/import_legacy_users.mjs --file "..." --limit 50 --commit
 *   node prisma/import_legacy_users.mjs --file "..." --commit
 *
 * Flags
 *   --file <path>   CSV to read (required)
 *   --commit        actually write to the database (default: dry run)
 *   --limit <n>     only process the first n CSV rows (for a trial run)
 *   --reissue       also mint fresh links for previously-imported accounts that
 *                   still have no password (use if a mail-merge batch was lost)
 *   --out <dir>     output directory (default: migration-out)
 *   --allow-localhost
 *                   permit minting links against a localhost base URL (testing
 *                   only — real runs need PUBLIC_BASE_URL set)
 *
 * Idempotent: reruns match on legacyId then email, never duplicate users or
 * enrolments, and never touch an account that already has a password.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import pkg from "../src/generated/prisma/index.js";
import { LEGACY_COURSE_MAP, LEGACY_COURSE_SKIP } from "./legacy-course-map.mjs";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// --- Must stay in sync with src/lib/invite.ts -------------------------------
const ACTIVATION_TTL_DAYS = 60;
const hashToken = (raw) => createHash("sha256").update(raw).digest("hex");
const newRawToken = () => randomBytes(32).toString("base64url");
const BASE_URL = (
  process.env.PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.AUTH_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");
const activationUrl = (t) => `${BASE_URL}/activate/${t}`;
// ---------------------------------------------------------------------------

// --- args ------------------------------------------------------------------
function args(argv) {
  const o = { commit: false, reissue: false, allowLocalhost: false, out: "migration-out", limit: 0, file: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--commit") o.commit = true;
    else if (a === "--reissue") o.reissue = true;
    else if (a === "--allow-localhost") o.allowLocalhost = true;
    else if (a === "--limit") o.limit = Number(argv[++i] ?? 0) || 0;
    else if (a === "--out") o.out = argv[++i] ?? o.out;
    else if (a === "--file") o.file = argv[++i] ?? "";
  }
  return o;
}
const OPTS = args(process.argv);

// --- CSV (RFC 4180) --------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// --- classification --------------------------------------------------------
const US_STATES = new Set(
  [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
    "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
    "Washington", "West Virginia", "Wisconsin", "Wyoming",
    "District of Columbia", "Guam", "Puerto Rico",
  ].map((s) => s.toLowerCase())
);

/** Tag / group values that mark a non-law-enforcement account. */
const CIVILIAN_MARK = /non\s*-?\s*leo|^civilian/i;
/** Entity answers that prove law enforcement standing. */
const LE_ENTITY =
  /law enforcement|district attorney|probation or parole|federal probation/i;
/** The "I'm just a DataPilot customer" answer — civilian unless paired with LE. */
const CUSTOMER_ONLY = /datapilot customer only/i;

const list = (v) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * LE vs CIVILIAN. Three independent signals, any one of which flags a civilian —
 * but an explicit law-enforcement entity answer always wins, because a handful
 * of real officers also ticked "DataPilot Customer ONLY".
 */
function classifyAudience(rec, entityCol) {
  const entity = String(rec[entityCol] ?? "");
  if (LE_ENTITY.test(entity)) return { audience: "LE", why: "entity: LE" };

  const tags = list(rec.tags);
  const groups = list(rec["user groups"]);
  if (tags.some((t) => CIVILIAN_MARK.test(t)))
    return { audience: "CIVILIAN", why: "tag" };
  if (groups.some((g) => CIVILIAN_MARK.test(g)))
    return { audience: "CIVILIAN", why: "user group" };
  if (CUSTOMER_ONLY.test(entity))
    return { audience: "CIVILIAN", why: "entity: customer only" };

  return { audience: "LE", why: "default" };
}

function pickState(rec) {
  for (const t of list(rec.tags)) {
    if (US_STATES.has(t.toLowerCase())) return t;
  }
  return "";
}

function pickName(rec) {
  const u = String(rec.username ?? "").trim();
  if (u && !/^https?:/i.test(u)) return u.slice(0, 120);
  const local = String(rec.email ?? "").split("@")[0] ?? "";
  return (local.replace(/[._-]+/g, " ").trim() || "Investigator").slice(0, 120);
}

function pickAgency(rec, employerCol) {
  const a = String(rec.Agency ?? "").trim();
  if (a) return a.slice(0, 160);
  return String(rec[employerCol] ?? "").trim().slice(0, 160);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function parseSignup(v) {
  const d = new Date(String(v ?? "").trim());
  return Number.isFinite(d.getTime()) ? d : null;
}

// --- chunked bulk helpers --------------------------------------------------
async function createManyChunked(model, rows, size = 500) {
  let made = 0;
  for (let i = 0; i < rows.length; i += size) {
    const res = await model.createMany({
      data: rows.slice(i, i + size),
      skipDuplicates: true,
    });
    made += res.count;
  }
  return made;
}

// --- main ------------------------------------------------------------------
async function main() {
  if (!OPTS.file) throw new Error("Pass --file <path to export csv>");
  if (!fs.existsSync(OPTS.file)) throw new Error(`No such file: ${OPTS.file}`);

  // Activation links are permanent artefacts of a mail-merge: if they get minted
  // against localhost, 5,000 people receive a dead link and every token has to be
  // reissued. Refuse rather than let that happen quietly.
  if (OPTS.commit && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(BASE_URL) && !OPTS.allowLocalhost) {
    throw new Error(
      `Refusing to mint activation links against ${BASE_URL}.\n` +
        `Set PUBLIC_BASE_URL to the real site origin first, e.g.\n` +
        `  set PUBLIC_BASE_URL=https://your-domain.com\n` +
        `Or pass --allow-localhost if you are deliberately testing.`
    );
  }

  const raw = fs.readFileSync(OPTS.file, "utf8").replace(/^\uFEFF/, "");
  const table = parseCsv(raw);
  const head = table[0];

  // The LE-verification question and employer field are long free-text column
  // headers; locate them by content rather than hard-coding the prose.
  const entityCol =
    head.find((h) => /what entity do you work for/i.test(h)) ?? "";
  const employerCol = head.find((h) => /^employer name$/i.test(h)) ?? "";

  let dataRows = table.slice(1).filter((r) => r.length > 3);
  if (OPTS.limit > 0) dataRows = dataRows.slice(0, OPTS.limit);

  const recs = dataRows.map((r) =>
    Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""]))
  );

  // ---- pass 1: normalise + dedupe by email -------------------------------
  /** @type {Map<string, {legacyId:string,email:string,name:string,agency:string,state:string,audience:string,createdAt:Date|null,slugs:Set<string>}>} */
  const byEmail = new Map();
  const skippedNoEmail = [];
  const skippedBadEmail = [];
  let dupeRows = 0;
  const audienceWhy = new Map();
  const legacySlugCount = new Map();

  for (const rec of recs) {
    const email = String(rec.email ?? "").trim().toLowerCase();
    if (!email) {
      skippedNoEmail.push(rec.id || "(no id)");
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      skippedBadEmail.push(email);
      continue;
    }

    const slugs = list(rec.courses);
    for (const s of slugs)
      legacySlugCount.set(s, (legacySlugCount.get(s) ?? 0) + 1);

    const existing = byEmail.get(email);
    if (existing) {
      // Same person twice in the export — union their course history.
      dupeRows++;
      for (const s of slugs) existing.slugs.add(s);
      continue;
    }

    const { audience, why } = classifyAudience(rec, entityCol);
    audienceWhy.set(why, (audienceWhy.get(why) ?? 0) + 1);

    byEmail.set(email, {
      legacyId: String(rec.id ?? "").trim() || null,
      email,
      name: pickName(rec),
      agency: pickAgency(rec, employerCol),
      state: pickState(rec),
      audience,
      createdAt: parseSignup(rec.signup),
      slugs: new Set(slugs),
    });
  }

  // ---- resolve target courses -------------------------------------------
  const targetSlugs = [...new Set(Object.values(LEGACY_COURSE_MAP))];
  const courses = await prisma.course.findMany({
    where: { slug: { in: targetSlugs } },
    select: { id: true, slug: true, title: true },
  });
  const courseIdBySlug = new Map(courses.map((c) => [c.slug, c.id]));
  const missingTargets = targetSlugs.filter((s) => !courseIdBySlug.has(s));

  // ---- existing accounts -------------------------------------------------
  const emails = [...byEmail.keys()];
  const existingUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: emails } },
        { legacyId: { in: [...byEmail.values()].map((u) => u.legacyId).filter(Boolean) } },
      ],
    },
    select: { id: true, email: true, legacyId: true, passwordHash: true, importedAt: true },
  });
  const existingByEmail = new Map(existingUsers.map((u) => [u.email, u]));

  const toCreate = [];
  const alreadyPresent = [];
  for (const u of byEmail.values()) {
    if (existingByEmail.has(u.email)) alreadyPresent.push(u);
    else toCreate.push(u);
  }

  const audienceSplit = { LE: 0, CIVILIAN: 0 };
  for (const u of byEmail.values()) audienceSplit[u.audience]++;

  // ---- write -------------------------------------------------------------
  const now = new Date();
  const issuedBy = `legacy-import ${now.toISOString().slice(0, 10)}`;
  let createdUsers = 0;
  let createdEnrollments = 0;
  const links = [];

  if (OPTS.commit && toCreate.length) {
    createdUsers = await createManyChunked(
      prisma.user,
      toCreate.map((u) => ({
        name: u.name,
        email: u.email,
        agency: u.agency,
        state: u.state,
        audience: u.audience,
        // No password: the account is unusable until the activation link is
        // redeemed. Approved because the legacy site already gated these people.
        passwordHash: null,
        status: "APPROVED",
        approvedAt: now,
        legacyId: u.legacyId,
        importedAt: now,
        ...(u.createdAt ? { createdAt: u.createdAt } : {}),
      }))
    );
  }

  // Re-read so we have ids for everyone (created just now or pre-existing).
  const allUsers = OPTS.commit
    ? await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, passwordHash: true, importedAt: true },
      })
    : existingUsers;
  const idByEmail = new Map(allUsers.map((u) => [u.email, u.id]));

  // Enrolments — for everyone in the CSV, existing accounts included. Adding a
  // course someone already held is the whole point of a rerun.
  const enrollRows = [];
  const enrollPerCourse = new Map();
  let intendedEnrollments = 0;
  for (const u of byEmail.values()) {
    const userId = idByEmail.get(u.email);
    for (const legacySlug of u.slugs) {
      const targetSlug = LEGACY_COURSE_MAP[legacySlug];
      if (!targetSlug) continue;
      const courseId = courseIdBySlug.get(targetSlug);
      if (!courseId) continue;
      enrollPerCourse.set(targetSlug, (enrollPerCourse.get(targetSlug) ?? 0) + 1);
      intendedEnrollments++;
      if (userId) enrollRows.push({ userId, courseId });
    }
  }

  if (OPTS.commit && enrollRows.length) {
    createdEnrollments = await createManyChunked(prisma.enrollment, enrollRows);
  }

  // Activation links — new accounts, plus (with --reissue) any previously
  // imported account still sitting without a password.
  const needLink = [];
  if (OPTS.commit) {
    const passwordless = new Map(
      allUsers.filter((u) => !u.passwordHash).map((u) => [u.email, u])
    );
    for (const u of byEmail.values()) {
      const row = passwordless.get(u.email);
      if (!row) continue;
      const isNew = toCreate.some((c) => c.email === u.email);
      if (isNew || OPTS.reissue) needLink.push({ ...u, id: row.id });
    }

    const tokenRows = needLink.map((u) => {
      const rawToken = newRawToken();
      links.push({ email: u.email, name: u.name, url: activationUrl(rawToken) });
      return {
        userId: u.id,
        tokenHash: hashToken(rawToken),
        purpose: "ACTIVATION",
        expiresAt: new Date(now.getTime() + ACTIVATION_TTL_DAYS * 86400000),
        issuedBy,
      };
    });

    if (OPTS.reissue && needLink.length) {
      // Burn older unused activation tokens so only the newest link works.
      await prisma.inviteToken.updateMany({
        where: {
          userId: { in: needLink.map((u) => u.id) },
          purpose: "ACTIVATION",
          usedAt: null,
        },
        data: { usedAt: now },
      });
    }
    await createManyChunked(prisma.inviteToken, tokenRows);
  }

  // ---- report ------------------------------------------------------------
  const unmapped = [...legacySlugCount.entries()]
    .filter(([s]) => !LEGACY_COURSE_MAP[s])
    .sort((a, b) => b[1] - a[1]);

  const L = [];
  L.push(`LEGACY IMPORT ${OPTS.commit ? "— COMMITTED" : "— DRY RUN (no writes)"}`);
  L.push(`when      ${now.toISOString()}`);
  L.push(`source    ${OPTS.file}`);
  L.push(`base url  ${BASE_URL}`);
  if (OPTS.limit) L.push(`limit     first ${OPTS.limit} rows only`);
  L.push("");
  L.push("-- rows ------------------------------------------------------------");
  L.push(`csv rows read           ${recs.length}`);
  L.push(`unique people           ${byEmail.size}`);
  L.push(`duplicate rows merged   ${dupeRows}`);
  L.push(`skipped, no email       ${skippedNoEmail.length}`);
  L.push(`skipped, bad email      ${skippedBadEmail.length}`);
  if (skippedBadEmail.length)
    L.push(`   e.g. ${skippedBadEmail.slice(0, 8).join(", ")}`);
  L.push("");
  L.push("-- accounts --------------------------------------------------------");
  L.push(`already on platform     ${alreadyPresent.length} (left untouched)`);
  L.push(`to create               ${toCreate.length}`);
  L.push(`created                 ${OPTS.commit ? createdUsers : "(dry run)"}`);
  L.push(`audience LE             ${audienceSplit.LE}`);
  L.push(`audience CIVILIAN       ${audienceSplit.CIVILIAN}`);
  L.push("audience decided by:");
  for (const [why, n] of [...audienceWhy.entries()].sort((a, b) => b[1] - a[1]))
    L.push(`   ${String(n).padStart(6)}  ${why}`);
  L.push("");
  L.push("-- enrolments ------------------------------------------------------");
  if (missingTargets.length)
    L.push(`!! target course slugs not found in db: ${missingTargets.join(", ")}`);
  for (const [slug, n] of [...enrollPerCourse.entries()].sort((a, b) => b[1] - a[1]))
    L.push(`${String(n).padStart(6)}  → ${slug}`);
  L.push(`total enrolment rows    ${intendedEnrollments}`);
  L.push(
    `newly created           ${OPTS.commit ? createdEnrollments : "(dry run — user ids don't exist yet)"}`
  );
  L.push("");
  L.push("-- legacy courses NOT migrated -------------------------------------");
  for (const [slug, n] of unmapped) {
    const why = LEGACY_COURSE_SKIP[slug] ?? "no equivalent course on this platform";
    L.push(`${String(n).padStart(6)}  ${slug}`);
    L.push(`        ${why}`);
  }
  L.push("");
  L.push("-- activation links ------------------------------------------------");
  L.push(`links minted            ${OPTS.commit ? links.length : "(dry run)"}`);
  if (!OPTS.commit)
    L.push(`would mint              ${toCreate.length}${OPTS.reissue ? " + any passwordless existing" : ""}`);

  const outDir = path.resolve(OPTS.out);
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = path.join(outDir, `import-report-${stamp}.txt`);
  fs.writeFileSync(reportPath, L.join("\n") + "\n");

  let linkPath = "";
  if (links.length) {
    linkPath = path.join(outDir, `activation-links-${stamp}.csv`);
    fs.writeFileSync(
      linkPath,
      ["email,name,activation_url"]
        .concat(links.map((l) => [l.email, l.name, l.url].map(csvCell).join(",")))
        .join("\n") + "\n"
    );
  }

  console.log(L.join("\n"));
  console.log(`\nreport → ${reportPath}`);
  if (linkPath) console.log(`links  → ${linkPath}   (CREDENTIAL MATERIAL — do not commit or forward)`);
  if (!OPTS.commit) console.log("\nDry run. Re-run with --commit to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
