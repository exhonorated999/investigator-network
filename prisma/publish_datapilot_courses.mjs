/**
 * Publish DATAPILOT Desktop Essentials and open every DataPilot product course
 * to civilians. The legacy site sold DataPilot training to non-LE customers, so
 * audience gating would otherwise hide courses those accounts already hold.
 */
import pkg from "../src/generated/prisma/index.js";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

await prisma.course.update({
  where: { slug: "datapilot-desktop-essentials" },
  data: { status: "PUBLISHED" },
});

const datapilot = await prisma.course.findMany({
  where: { OR: [{ slug: { contains: "datapilot" } }, { title: { contains: "atapilot" } }] },
  select: { id: true, slug: true },
});

await prisma.course.updateMany({
  where: { id: { in: datapilot.map((c) => c.id) } },
  data: { audiences: ["LE", "CIVILIAN"] },
});

const all = await prisma.course.findMany({
  select: {
    slug: true,
    title: true,
    status: true,
    pricing: true,
    audiences: true,
    _count: { select: { enrollments: true } },
  },
  orderBy: { slug: "asc" },
});
for (const c of all)
  console.log(
    `${c.status.padEnd(9)} ${c.pricing.padEnd(4)} ${c.audiences.join(",").padEnd(12)} enr=${String(c._count.enrollments).padStart(5)}  ${c.slug}`
  );

await prisma.$disconnect();
