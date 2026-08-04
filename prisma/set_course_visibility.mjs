/**
 * Course visibility policy pass.
 *
 *   - Every DataPilot-family course becomes private (unlisted): it never shows
 *     in the library, only enrolled learners see it. The 5,743 migrated legacy
 *     users are already enrolled, so they keep access; everyone else does not
 *     get a self-serve door in.
 *   - Project VIPER is public, FREE, and LE-only.
 *
 * Idempotent. Run:  node prisma/set_course_visibility.mjs
 */
import pkg from "../src/generated/prisma/index.js";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const DATAPILOT = {
  OR: [{ slug: { contains: "datapilot" } }, { title: { contains: "atapilot" } }],
};

const dp = await prisma.course.findMany({
  where: DATAPILOT,
  select: { id: true, slug: true },
});

await prisma.course.updateMany({
  where: { id: { in: dp.map((c) => c.id) } },
  data: { isPrivate: true },
});
console.log(`private: ${dp.map((c) => c.slug).join(", ")}`);

const viper = await prisma.course.update({
  where: { slug: "project-v-i-p-e-r" },
  data: {
    isPrivate: false,
    pricing: "FREE",
    audiences: ["LE"],
    status: "PUBLISHED",
  },
  select: { slug: true },
});
console.log(`public/free/LE-only: ${viper.slug}`);

const all = await prisma.course.findMany({
  orderBy: { slug: "asc" },
  select: {
    slug: true,
    status: true,
    isPrivate: true,
    pricing: true,
    audiences: true,
    _count: { select: { enrollments: true } },
  },
});
console.log("");
for (const c of all) {
  console.log(
    [
      c.slug.padEnd(38),
      c.status.padEnd(9),
      (c.isPrivate ? "PRIVATE" : "listed").padEnd(8),
      c.pricing.padEnd(5),
      c.audiences.join("+").padEnd(12),
      `${c._count.enrollments} enrolled`,
    ].join(" ")
  );
}

await prisma.$disconnect();
