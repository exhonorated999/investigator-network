/**
 * Remove an imported legacy account. Only ever touches rows that came from the
 * migration (importedAt set) and that still have no password, so it cannot
 * delete a real, activated account by accident.
 */
import pkg from "../src/generated/prisma/index.js";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) throw new Error("usage: node prisma/remove_imported_user.mjs <email>");

const u = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, name: true, importedAt: true, passwordHash: true, role: true },
});

if (!u) {
  console.log(`no such user: ${email}`);
} else if (!u.importedAt) {
  console.log(`refusing: ${email} is a native account, not an import.`);
} else if (u.passwordHash) {
  console.log(`refusing: ${email} has an activated password — someone is using it.`);
} else {
  const e = await prisma.enrollment.deleteMany({ where: { userId: u.id } });
  const t = await prisma.inviteToken.deleteMany({ where: { userId: u.id } });
  await prisma.user.delete({ where: { id: u.id } });
  console.log(`deleted ${u.email} ("${u.name}") — enrollments=${e.count} tokens=${t.count}`);
}

await prisma.$disconnect();
