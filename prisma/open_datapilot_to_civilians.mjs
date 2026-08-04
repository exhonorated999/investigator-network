/**
 * Open the DataPilot product courses to civilians.
 *
 * The legacy site sold DataPilot training to non-LE customers ("Non-LEO
 * DataPilot" group). Those accounts import as CIVILIAN, and audience gating
 * would otherwise hide the very courses they already paid for.
 */
import pkg from "../src/generated/prisma/index.js";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const SLUGS = ["datapilot-scout", "datapilot-dpx-dp10-essentials"];

const res = await prisma.course.updateMany({
  where: { slug: { in: SLUGS } },
  data: { audiences: ["LE", "CIVILIAN"] },
});

const after = await prisma.course.findMany({
  where: { slug: { in: SLUGS } },
  select: { slug: true, audiences: true },
});
console.log(`updated ${res.count}`);
for (const c of after) console.log(`  ${c.slug} → ${c.audiences.join(",")}`);
await prisma.$disconnect();
