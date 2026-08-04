/**
 * Load the shared bootstrap password onto every dormant migrated account.
 *
 * Dormant = imported from the legacy platform AND passwordHash IS NULL. Anyone
 * who has already chosen a real password is never touched, and native (non-
 * imported) accounts are never touched either.
 *
 * Each account gets `mustChangePassword = true`, so the first successful login
 * lands on /change-password and can go nowhere else until they pick their own.
 *
 * SECURITY NOTE: one password shared across thousands of law-enforcement
 * accounts is a master key. Anyone who learns it can sign into any account that
 * has not yet changed it. This was an explicit, informed decision by the
 * platform owner, who mails the password to each user individually. Watch the
 * dormant count fall over time; consider force-expiring the stragglers.
 *
 * Dry run (default):  node prisma/set_bootstrap_password.mjs
 * Apply:              node prisma/set_bootstrap_password.mjs --commit
 */
import bcrypt from "bcryptjs";
import pkg from "../src/generated/prisma/index.js";
const { PrismaClient } = pkg;

const BOOTSTRAP_PASSWORD = "Ipreventcrime1!";
const ROUNDS = 12; // must match src/lib/password.ts
const COMMIT = process.argv.includes("--commit");
const CHUNK = 500;

const prisma = new PrismaClient();

const dormant = await prisma.user.findMany({
  where: { passwordHash: null, importedAt: { not: null } },
  select: { id: true },
});

const otherDormant = await prisma.user.count({
  where: { passwordHash: null, importedAt: null },
});
const alreadySet = await prisma.user.count({
  where: { mustChangePassword: true },
});

console.log(`dormant migrated accounts .......... ${dormant.length}`);
console.log(`dormant native accounts (skipped) .. ${otherDormant}`);
console.log(`already flagged mustChangePassword .. ${alreadySet}`);

if (!COMMIT) {
  console.log("\ndry run — nothing written. re-run with --commit");
  await prisma.$disconnect();
  process.exit(0);
}

// One bcrypt call, reused for every row. The salt is therefore shared, but so is
// the password — an attacker who cracks one hash has them all regardless, and
// 5,700 sequential bcrypt(12) hashes would take the better part of an hour.
const hash = await bcrypt.hash(BOOTSTRAP_PASSWORD, ROUNDS);

let done = 0;
for (let i = 0; i < dormant.length; i += CHUNK) {
  const ids = dormant.slice(i, i + CHUNK).map((u) => u.id);
  const res = await prisma.user.updateMany({
    where: { id: { in: ids }, passwordHash: null },
    data: { passwordHash: hash, mustChangePassword: true },
  });
  done += res.count;
  console.log(`  updated ${done}/${dormant.length}`);
}

const check = await prisma.user.aggregate({ _count: true });
const stillDormant = await prisma.user.count({ where: { passwordHash: null } });
const flagged = await prisma.user.count({ where: { mustChangePassword: true } });
const verified = await bcrypt.compare(BOOTSTRAP_PASSWORD, hash);

console.log("");
console.log(`total users ................ ${check._count}`);
console.log(`still without a password ... ${stillDormant}`);
console.log(`must change password ....... ${flagged}`);
console.log(`hash verifies .............. ${verified}`);

await prisma.$disconnect();
