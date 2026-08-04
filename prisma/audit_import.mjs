import pkg from "../src/generated/prisma/index.js";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const total = await prisma.user.count();
const imported = await prisma.user.count({ where: { importedAt: { not: null } } });
const dormant = await prisma.user.count({ where: { passwordHash: null } });
const withPw = await prisma.user.count({ where: { passwordHash: { not: null } } });
const enr = await prisma.enrollment.count();
const tokens = await prisma.inviteToken.count();

console.log(`users=${total} imported=${imported} dormant=${dormant} withPassword=${withPw} enrollments=${enr} tokens=${tokens}`);

console.log("\n-- non-imported (native) accounts --");
for (const u of await prisma.user.findMany({
  where: { importedAt: null },
  select: { email: true, role: true, status: true, isSuperAdmin: true },
})) {
  console.log(`  ${u.email} | ${u.role}${u.isSuperAdmin ? " SUPER" : ""} | ${u.status}`);
}

console.log("\n-- sample imported --");
for (const u of await prisma.user.findMany({
  where: { importedAt: { not: null } },
  take: 5,
  select: { email: true, name: true, agency: true, state: true, audience: true, status: true, legacyId: true, createdAt: true, enrollments: { select: { course: { select: { slug: true } } } } },
})) {
  console.log(`  ${u.email} | ${u.name} | ${u.agency} | ${u.state} | ${u.audience} | ${u.status} | legacy=${u.legacyId} | ${u.createdAt.toISOString().slice(0, 10)} | ${u.enrollments.map((e) => e.course.slug).join("+")}`);
}

const dupes = await prisma.$queryRawUnsafe(
  `SELECT lower(email) e, count(*) c FROM "User" GROUP BY 1 HAVING count(*) > 1`
);
console.log(`\nduplicate emails: ${dupes.length}`);
await prisma.$disconnect();
