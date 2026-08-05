/**
 * One-time bulk migration:
 *   1. Wipe sample/seed content (news articles + community posts).
 *   2. Enroll every legacy "advanced-datapilot" holder into the new course.
 *   3. Mark courses COMPLETE for users who hold a legacy certificate.
 *
 * Dry-run by default. Pass --commit to write.
 *
 *   node prisma/cleanup_and_enroll.mjs           # dry-run report
 *   node prisma/cleanup_and_enroll.mjs --commit  # apply
 */
import pkg from "../src/generated/prisma/index.js";
import { promises as fs } from "fs";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const COMMIT = process.argv.includes("--commit");

const UP = "C:\\Users\\JUSTI\\Workspace\\uploads\\";
const USERS_CSV = UP + "users-export-2026-07-29_14-37-32-6a6a729306a6daa8f100db2c.csv";
const CERT_FILES = [
  { file: UP + "2026-08-05_CertificatesExport.csv", slug: "advanced-datapilot", legacy: "Advanced Datapilot - Virtual" },
  { file: UP + "certificates-export-2026-08-05_08-29-46-6a7356d96b2dd025e00e87c1.csv", slug: "datapilot-dpx-dp10-essentials", legacy: "Datapilot 10/ X Essentials" },
];
const ADV_SLUG = "advanced-datapilot";

// ---- CSV parser (RFC4180-ish) ---------------------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
async function load(p) {
  const rows = parseCSV(await fs.readFile(p, "utf8")).filter(r => r.length > 1 || (r[0] ?? "").trim() !== "");
  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  return { idx, rows: rows.slice(1) };
}
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

async function main() {
  console.log(`\n=== cleanup_and_enroll  (${COMMIT ? "COMMIT" : "DRY-RUN"}) ===\n`);

  // Build a global lowercase-email -> userId map once.
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const emailToId = new Map();
  for (const u of allUsers) if (u.email) emailToId.set(u.email.trim().toLowerCase(), u.id);
  console.log(`User accounts on platform: ${allUsers.length}\n`);

  // -------------------------------------------------------------- Phase 1 --
  const [nNews, nPosts, nComments, nReactions] = await Promise.all([
    prisma.newsArticle.count(), prisma.post.count(),
    prisma.postComment.count(), prisma.postReaction.count(),
  ]);
  console.log("── Phase 1: wipe sample content ──");
  console.log(`  news=${nNews}  posts=${nPosts}  comments=${nComments}  reactions=${nReactions}`);
  if (COMMIT) {
    const rx = await prisma.postReaction.deleteMany({});
    const pc = await prisma.postComment.deleteMany({});
    const po = await prisma.post.deleteMany({});
    const na = await prisma.newsArticle.deleteMany({});
    console.log(`  DELETED reactions=${rx.count} comments=${pc.count} posts=${po.count} news=${na.count}`);
  } else {
    console.log("  (dry-run) would delete all of the above");
  }

  // -------------------------------------------------------------- Phase 2 --
  console.log("\n── Phase 2: enroll legacy advanced-datapilot holders ──");
  const advCourse = await prisma.course.findUnique({ where: { slug: ADV_SLUG }, select: { id: true } });
  if (!advCourse) throw new Error(`missing course ${ADV_SLUG}`);
  const users = await load(USERS_CSV);
  const eCol = users.idx["email"], cCol = users.idx["courses"];
  const advEmails = new Set();
  for (const r of users.rows) {
    const email = (r[eCol] || "").trim().toLowerCase();
    if (email && /\badvanced-datapilot\b/.test(r[cCol] || "")) advEmails.add(email);
  }
  const advMatched = [], advUnmatched = [];
  for (const e of advEmails) (emailToId.has(e) ? advMatched : advUnmatched).push(e);
  console.log(`  legacy holders: ${advEmails.size}  matched: ${advMatched.length}  unmatched: ${advUnmatched.length}`);
  if (COMMIT) {
    let created = 0;
    for (const c of chunk(advMatched, 500)) {
      const res = await prisma.enrollment.createMany({
        data: c.map(e => ({ userId: emailToId.get(e), courseId: advCourse.id })),
        skipDuplicates: true,
      });
      created += res.count;
    }
    console.log(`  enrollments created (new): ${created}  (already-enrolled skipped: ${advMatched.length - created})`);
  } else {
    console.log("  (dry-run) would upsert enrollments for matched users");
  }

  // -------------------------------------------------------------- Phase 3 --
  console.log("\n── Phase 3: mark courses complete for certificate holders ──");
  for (const cf of CERT_FILES) {
    const course = await prisma.course.findUnique({ where: { slug: cf.slug }, select: { id: true } });
    if (!course) throw new Error(`missing course ${cf.slug}`);
    const units = await prisma.unit.findMany({ where: { section: { courseId: course.id } }, select: { id: true } });
    const unitIds = units.map(u => u.id);

    const data = await load(cf.file);
    const emCol = data.idx["email"];
    const emails = new Set();
    for (const r of data.rows) { const e = (r[emCol] || "").trim().toLowerCase(); if (e) emails.add(e); }
    const matched = [], unmatched = [];
    for (const e of emails) (emailToId.has(e) ? matched : unmatched).push(e);
    const userIds = matched.map(e => emailToId.get(e));

    console.log(`\n  [${cf.slug}]  cert emails: ${emails.size}  matched: ${matched.length}  unmatched: ${unmatched.length}  units/course: ${unitIds.length}`);

    if (COMMIT) {
      // Enroll
      let enr = 0;
      for (const c of chunk(userIds, 500)) {
        const r = await prisma.enrollment.createMany({
          data: c.map(id => ({ userId: id, courseId: course.id })), skipDuplicates: true,
        });
        enr += r.count;
      }
      // Create any missing UnitProgress rows as COMPLETE (skipDuplicates keeps existing).
      let createdProg = 0;
      const pairs = [];
      for (const id of userIds) for (const uid of unitIds) pairs.push({ userId: id, unitId: uid, status: "COMPLETE", completedAt: new Date() });
      for (const c of chunk(pairs, 1000)) {
        const r = await prisma.unitProgress.createMany({ data: c, skipDuplicates: true });
        createdProg += r.count;
      }
      // Force existing rows to COMPLETE too.
      let updated = 0;
      for (const c of chunk(userIds, 300)) {
        const r = await prisma.unitProgress.updateMany({
          where: { userId: { in: c }, unitId: { in: unitIds }, status: { not: "COMPLETE" } },
          data: { status: "COMPLETE", completedAt: new Date() },
        });
        updated += r.count;
      }
      console.log(`    enrollments new: ${enr}  progress rows created: ${createdProg}  progress rows updated->COMPLETE: ${updated}`);
    } else {
      console.log(`    (dry-run) would enroll + write ${matched.length * unitIds.length} COMPLETE progress rows`);
    }
    if (unmatched.length) console.log(`    unmatched sample: ${unmatched.slice(0, 5).join(", ")}${unmatched.length > 5 ? " ..." : ""}`);
  }

  console.log("\n=== done ===\n");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
