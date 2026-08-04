// Seed the "DATAPILOT Desktop Essentials" hybrid course.
//   Run: node prisma/seed_datapilot.mjs
//
// Idempotent-ish: if a course with the target slug already exists the script
// stops instead of creating a duplicate. Delete that course from the admin UI
// first if you want a clean re-seed.
import pkg from "../src/generated/prisma/index.js";
const { PrismaClient } = pkg;
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const SLUG = "datapilot-desktop-essentials";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./.uploads";
const COVER_REL = "course-cover/datapilot-desktop-cover.png";

/** Short opaque block id, matching lib/blocks.ts newBlockId() shape closely. */
const bid = () => `b${randomUUID().replace(/-/g, "").slice(0, 12)}`;

// --- Block factories (mirror lib/blocks.ts shapes) -------------------------
const heading = (text, eyebrow = "") => ({ id: bid(), type: "heading", level: 2, text, eyebrow });
const divider = () => ({ id: bid(), type: "divider", label: "" });
const callout = (title, markdown, variant = "note") => ({ id: bid(), type: "callout", variant, title, markdown });
const embed = (url, title, height = 0) => ({ id: bid(), type: "embed", url, title, height });

async function main() {
  const existing = await prisma.course.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Course "${SLUG}" already exists (id=${existing.id}). Aborting to avoid a duplicate.`);
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error("No ADMIN user found. Run the base seed first.");

  // --- Cover image: register the saved file so /api/files/[id] can serve it.
  let coverImage = null;
  try {
    const abs = path.join(UPLOAD_DIR, COVER_REL);
    const stat = await fs.stat(abs);
    const file = await prisma.fileUpload.create({
      data: {
        ownerUserId: admin.id,
        path: COVER_REL,
        filename: "datapilot-desktop-cover.png",
        mimeType: "image/png",
        sizeBytes: stat.size,
        purpose: "course-cover",
      },
    });
    coverImage = `/api/files/${file.id}`;
  } catch (e) {
    console.warn(`Cover image not registered (${e.message}). Course will have no cover.`);
  }

  // --- Category
  const category = await prisma.category.upsert({
    where: { name: "Product Training" },
    update: {},
    create: { name: "Product Training" },
  });

  // --- Course
  const course = await prisma.course.create({
    data: {
      title: "DATAPILOT Desktop Essentials",
      slug: SLUG,
      description:
        "A hybrid essentials course for DATAPILOT Desktop. Attend a live " +
        "instructor-led session over Microsoft Teams, or complete the same " +
        "material on demand. Includes device setup walkthroughs and an " +
        "interactive course-notes workbook with guides and a presentation.",
      coverImage,
      status: "DRAFT",
      audiences: ["LE", "CIVILIAN"],
      isPrivate: false,
      pricing: "FREE",
      instructor: "DATAPILOT Training Team",
      categoryId: category.id,
    },
  });

  // --- Section 1: Live Training -------------------------------------------
  const live = await prisma.section.create({
    data: { courseId: course.id, title: "Live Training", order: 0 },
  });

  await prisma.unit.create({
    data: {
      sectionId: live.id,
      title: "Live Training — September 11, 2026 · 11:30 AM Pacific",
      type: "LIVE_SESSION",
      order: 0,
      data: {
        teamsJoinUrl: "https://teams.microsoft.com/meet/216133751932970?p=iZXevkB7102pmFfPKz",
        startsAt: "2026-09-11T11:30:00-07:00",
        durationMin: 90,
        replayUrl: "",
      },
    },
  });

  await prisma.unit.create({
    data: {
      sectionId: live.id,
      title: "Live Training — September 25, 2026 · 11:30 AM Pacific",
      type: "LIVE_SESSION",
      order: 1,
      data: {
        teamsJoinUrl: "https://teams.microsoft.com/meet/225507485154607?p=pvOv1SAPMZrawJMmaW",
        startsAt: "2026-09-25T11:30:00-07:00",
        durationMin: 90,
        replayUrl: "",
      },
    },
  });

  // --- Section 2: On-Demand Training --------------------------------------
  const onDemand = await prisma.section.create({
    data: { courseId: course.id, title: "On-Demand Training", order: 1 },
  });

  await prisma.unit.create({
    data: {
      sectionId: onDemand.id,
      title: "DATAPILOT Desktop Overview",
      type: "VIDEO",
      order: 0,
      // No source URL was provided yet — placeholder, add the Bunny video id in admin.
      data: { provider: "bunny", videoId: "", libraryId: "716625", durationSec: 0 },
    },
  });

  await prisma.unit.create({
    data: {
      sectionId: onDemand.id,
      title: "Setting Up Android Devices",
      type: "VIDEO",
      order: 1,
      data: {
        provider: "bunny",
        videoId: "132f16be-8f27-4335-9b6c-8e0a07d86bfc",
        libraryId: "716625",
        durationSec: 0,
      },
    },
  });

  await prisma.unit.create({
    data: {
      sectionId: onDemand.id,
      title: "Setting Up iOS Devices",
      type: "VIDEO",
      order: 2,
      data: {
        provider: "bunny",
        videoId: "a36f5ee1-6f5b-4394-8f8c-5fb34ffa3189",
        libraryId: "716625",
        durationSec: 0,
      },
    },
  });

  // --- Section 3: Course Notes (interactive) ------------------------------
  const notes = await prisma.section.create({
    data: { courseId: course.id, title: "Course Notes", order: 2 },
  });

  const blocks = [
    callout(
      "How to use this section",
      "Work through the presentation and the step-by-step guides below. Each " +
        "guide is interactive — click through the walkthrough or open it full " +
        "screen. Use these as a reference any time while working in DATAPILOT Desktop."
    ),
    heading("Course Presentation", "OVERVIEW"),
    embed("https://heyzine.com/flip-book/47cbfb9ec6.html", "DATAPILOT Desktop Presentation", 720),
    divider(),
    heading("Creating a Case in DATAPILOT Desktop", "GUIDE"),
    embed(
      "https://scribehow.com/embed/Accessing_and_Creating_New_Case_in_DATAPILOT_Desktop__ADTJM20eTMqfI1T8OTSb2Q?removeLogo=true",
      "Creating a Case in DATAPILOT Desktop",
      640
    ),
    divider(),
    heading("Reviewing Reports in DATAPILOT Desktop", "GUIDE"),
    embed(
      "https://scribehow.com/embed/Reviewing_Reports_in_NEW_Datapilot_Desktop_Reader__jDAd2oOyT7Kj0EU5cmoiAw?skipIntro=true&removeLogo=true&as=video",
      "Reviewing Reports in DATAPILOT Desktop",
      800
    ),
    divider(),
    heading("Flagging Evidence in DATAPILOT Desktop", "GUIDE"),
    embed(
      "https://scribehow.com/embed/Flagging_Evidence_in_Datapilot_Desktop__Cw-SxiZmRaWCdZJVhz820Q?skipIntro=true&removeLogo=true",
      "Flagging Evidence in DATAPILOT Desktop",
      640
    ),
  ];

  await prisma.unit.create({
    data: {
      sectionId: notes.id,
      title: "DATAPILOT Desktop — Course Notes",
      type: "NOTES",
      order: 0,
      data: { version: 1, blocks },
    },
  });

  console.log(`Created course "${course.title}" (id=${course.id}, slug=${course.slug}).`);
  console.log(`  cover: ${coverImage ?? "none"}`);
  console.log(`  owner/admin: ${admin.email}`);
  console.log(`  Status: DRAFT — review in admin, add the Overview video id, then Publish.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
