// Seed the "Cybertips A to Z" ICAC mentorship course.
//   Run: node prisma/seed_cybertips.mjs
//
// Aborts if the slug already exists, so it will not create duplicates.
import pkg from "../src/generated/prisma/index.js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const SLUG = "cybertips-a-to-z";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./.uploads";
const COVER_REL = "course-cover/cybertips-a-to-z-cover.svg";
const TEAMS_URL = "https://teams.microsoft.com/meet/214158541835162?p=LasoAKnzhUvNiJJfbk";

const bid = () => `b${randomUUID().replace(/-/g, "").slice(0, 12)}`;

// --- Block factories (mirror lib/blocks.ts shapes) -------------------------
const heading = (text, eyebrow = "") => ({ id: bid(), type: "heading", level: 2, text, eyebrow });
const sub = (text) => ({ id: bid(), type: "heading", level: 3, text, eyebrow: "" });
const rich = (markdown) => ({ id: bid(), type: "richText", markdown });
const divider = () => ({ id: bid(), type: "divider", label: "" });
const callout = (title, markdown, variant = "note") => ({ id: bid(), type: "callout", variant, title, markdown });
const checklist = (title, items) => ({
  id: bid(),
  type: "checklist",
  title,
  items: items.map((text) => ({ id: bid(), text })),
  required: false,
});

// --- Landing page (markdown, rendered on the course overview) --------------
const DESCRIPTION = `Cybertips A to Z is a three-day, online mentorship program for **brand-new ICAC detectives** — built to walk you through a live CyberTipline report from the moment it lands on your desk to the moment you knock on the door.

This is not a lecture series you forget a week later. The three days are deliberately spread across roughly two months so the training moves at the same speed your real case does.

## Why the schedule is spread over two months

Most ICAC training hands you eight hours of theory and sends you home. The problem is that an ICAC case does not happen in eight hours — it unfolds over weeks while you wait on providers. So we built the class around the case timeline instead of the calendar.

- **Day 1 — October 19.** We take a CyberTip apart, run the investigative steps, and you leave able to draft and submit your search warrants. After Day 1, you write your warrants and open your case.
- **Day 2 — November 9 (about four weeks later).** By now your warrant returns are coming back. We work those returns together — parsing them, corroborating your subject, identifying the target location, and building out probable cause for the residential warrant.
- **Day 3 — December 14 (about five weeks later).** Final prep before you execute. Operations planning, briefing documents, on-scene digital forensics strategy, interview approach, and charging.

In other words: **we work your cases with you.** You bring real cases and leave with real progress, not a binder.

## Who this course is for

- Detectives and investigators **newly assigned to ICAC** or a task force affiliate agency
- Officers who have just started receiving CyberTipline reports and need a repeatable workflow
- Small and rural agencies with no in-house ICAC mentor to lean on
- Supervisors who need to understand the ICAC case lifecycle to support their detective

You do not need prior digital-forensics experience. You do need to be an active law-enforcement professional with the ability to work a case during the program.

## What you will be able to do when you finish

- Triage and prioritize a CyberTipline report with confidence
- Preserve and request records from providers without burning your case
- Draft search warrants that survive review — with language you can reuse
- Read and parse warrant returns and turn raw data into probable cause
- Identify and confirm your subject and target location
- Build an operations plan and briefing packet for warrant execution
- Plan your on-scene approach, device seizure, triage, and interview
- Manage your caseload and documentation like a veteran

## Bonus: free lifetime Project V.I.P.E.R. license

Every attendee receives a **free lifetime license for Project V.I.P.E.R.** — a $600 value — the investigations management system built for exactly this kind of casework: parsing warrant returns, authoring warrants, compiling operations plans, and integrating third-party intelligence platforms.

We do not just hand you a license and wish you luck:

- We **teach you to use V.I.P.E.R. in class** to manage your actual caseload
- You are also enrolled in the full **Project V.I.P.E.R. course** on this platform
- We ship you a **500 GB hard drive with V.I.P.E.R. pre-installed and pre-registered**, so you are working your case on Day 1 instead of fighting an install

## Your instructor

**Justin Moyer** — former ICAC detective. Justin has been the primary investigator on **over 240 ICAC cases** and has assisted agencies on hundreds more.

- Certified **Shareazza LE** instructor through the Child Rescue Coalition
- Has trained **hundreds of law-enforcement professionals** across the United States and internationally in sex-offender management and supervision over the past six years
- Founder of Intellect LE — training and technology built by law enforcement, for law enforcement

## Registration

Seats are limited because this is a mentorship, not a webinar — Justin works cases with each attendee.

Use **Register & pay** above to reserve your seat instantly. If your agency needs to pay by **invoice or purchase order**, use **Request an invoice** and we will send the paperwork the same day.

Enrollment includes all three days, the course notes and templates, your lifetime Project V.I.P.E.R. license and pre-loaded drive, and access to the Project V.I.P.E.R. course.

Questions before you register? Email [justin@intellect-le.com](mailto:justin@intellect-le.com).`;

// --- Day notes -------------------------------------------------------------
const DAY1_BLOCKS = [
  callout(
    "Before Day 1",
    "Bring a **live CyberTipline report** you are able to discuss, your agency's " +
      "warrant template, and the name of the prosecutor who reviews your warrants. " +
      "If you do not have a tip yet, you will work an instructor-supplied example.",
    "evidence"
  ),
  heading("Day 1 — From CyberTip to Warrant", "OCTOBER 19 · 0800 PACIFIC"),
  rich(
    "Day 1 covers the front half of the case: understanding what you actually " +
      "received, verifying it, and converting it into legal process. You leave " +
      "today ready to write and submit your warrants."
  ),
  sub("Module 1 — Anatomy of a CyberTipline report"),
  rich(
    "- Where CyberTips come from and what NCMEC does and does not do\n" +
      "- Reading the report: reporting ESP, incident data, uploaded files, IP and timestamps\n" +
      "- What is *viewable by law enforcement* vs. what still requires legal process\n" +
      "- Triage: assessing priority, child-at-risk indicators, and jurisdiction"
  ),
  sub("Module 2 — First moves and preservation"),
  rich(
    "- Preservation letters: who to send them to and how fast the clock runs\n" +
      "- Subpoena vs. court order vs. search warrant — picking the right tool\n" +
      "- Resolving the IP address and identifying the subscriber\n" +
      "- Open-source and database corroboration before you commit to a target\n" +
      "- Common mistakes that compromise a case in the first 48 hours"
  ),
  sub("Module 3 — Drafting the search warrant"),
  rich(
    "- Structuring the affidavit: training and experience, probable cause, nexus\n" +
      "- Describing the account, device, and premises with particularity\n" +
      "- Language for CSAM, file-sharing, and account-based evidence\n" +
      "- Requesting the right data so you do not have to go back twice\n" +
      "- Working with your prosecutor and surviving review"
  ),
  divider(),
  checklist("Day 1 action items — complete before Day 2", [
    "Preservation request sent to every relevant provider",
    "Subscriber / IP resolution returned and documented",
    "Corroborating open-source and database checks documented",
    "Search warrant drafted",
    "Warrant reviewed by prosecutor and signed",
    "Warrant served on the provider and service date logged",
    "Case opened and documented in Project V.I.P.E.R.",
  ]),
  callout(
    "Between Day 1 and Day 2 — about four weeks",
    "This gap is intentional. Provider returns take weeks. Use the time to get " +
      "your warrants out and your case documented. Bring your returns to Day 2 — " +
      "that is the material we work with. Stuck before then? Post in the course " +
      "discussion or email justin@intellect-le.com.",
    "warning"
  ),
];

const DAY2_BLOCKS = [
  callout(
    "Before Day 2",
    "Bring your **warrant returns**. Have them downloaded and accessible on the " +
      "machine you are training on, along with your case file in Project V.I.P.E.R.",
    "evidence"
  ),
  heading("Day 2 — Working the Returns", "NOVEMBER 9 · 0800 PACIFIC"),
  rich(
    "Returns are where new detectives stall out. Today we open your actual " +
      "returns, make sense of the formats, and turn raw provider data into a " +
      "residential search warrant."
  ),
  sub("Module 1 — Reading provider returns"),
  rich(
    "- What each major provider actually sends back and how it is structured\n" +
      "- Parsing large returns without missing the evidence that matters\n" +
      "- Using Project V.I.P.E.R. to ingest and organize returns\n" +
      "- Reconciling account records, IP logs, and uploaded content\n" +
      "- Documenting what you found — and what you reviewed and excluded"
  ),
  sub("Module 2 — Confirming your subject and location"),
  rich(
    "- Attributing an account to a human being\n" +
      "- Multi-occupant residences, shared networks, and open Wi-Fi problems\n" +
      "- Additional process: financial, phone, secondary accounts\n" +
      "- Surveillance and pretext considerations\n" +
      "- Locking down the target address and who lives there"
  ),
  sub("Module 3 — The residential search warrant"),
  rich(
    "- Building probable cause from the returns you just parsed\n" +
      "- Drafting for devices, cloud accounts, and network equipment\n" +
      "- Anticipatory and nighttime-service considerations\n" +
      "- Authoring the warrant in Project V.I.P.E.R. and compiling exhibits"
  ),
  divider(),
  checklist("Day 2 action items — complete before Day 3", [
    "All warrant returns ingested and organized in Project V.I.P.E.R.",
    "Evidence of value identified, flagged, and documented",
    "Subject identified and attribution documented",
    "Target location confirmed and occupants identified",
    "Any follow-up legal process submitted",
    "Residential search warrant drafted",
    "Warrant submitted to prosecutor for review",
  ]),
  callout(
    "Between Day 2 and Day 3 — about five weeks",
    "Use this window to get your residential warrant reviewed and signed, and to " +
      "begin coordinating resources for execution. Day 3 is the final prep before " +
      "you go through the door.",
    "warning"
  ),
];

const DAY3_BLOCKS = [
  callout(
    "Before Day 3",
    "Bring your signed or pending residential warrant, your target address, and " +
      "anything you already have toward an operations plan.",
    "evidence"
  ),
  heading("Day 3 — Execution, Forensics, and Charging", "DECEMBER 14 · 0800 PACIFIC"),
  rich(
    "Final day. We prepare you to execute the warrant safely and competently, " +
      "handle the digital evidence on scene, conduct the interview, and finish " +
      "the case."
  ),
  sub("Module 1 — Operations planning"),
  rich(
    "- Building the operations plan and briefing packet in Project V.I.P.E.R.\n" +
      "- Threat assessment, records checks, and known-weapons research\n" +
      "- Personnel, roles, and assignments — including who touches devices\n" +
      "- Coordinating with your task force, forensic examiner, and victim services\n" +
      "- Contingencies: children on scene, media, and uncooperative occupants"
  ),
  sub("Module 2 — On scene"),
  rich(
    "- Securing the scene and the running-device problem\n" +
      "- Device identification, seizure, and documentation\n" +
      "- On-scene triage strategy and consent considerations\n" +
      "- Encryption, passcodes, and biometric access issues\n" +
      "- Chain of custody that holds up later"
  ),
  sub("Module 3 — Interview and case closure"),
  rich(
    "- Interview approach and structure for these subjects\n" +
      "- Admissions that matter and how to document them\n" +
      "- Victim identification and mandatory reporting obligations\n" +
      "- Charging decisions and working with your prosecutor\n" +
      "- Report writing, discovery, and preparing for court"
  ),
  sub("Module 4 — Managing the caseload after class"),
  rich(
    "- Using Project V.I.P.E.R. to run a full ICAC caseload\n" +
      "- Tracking deadlines, returns, and pending process\n" +
      "- Metrics and reporting for your supervisor and task force\n" +
      "- Staying current, and how to reach us after the class ends"
  ),
  divider(),
  checklist("Day 3 action items", [
    "Operations plan completed and briefed",
    "Warrant executed and return filed",
    "Devices seized, documented, and submitted for examination",
    "Subject interview completed and documented",
    "Charging conferred with prosecutor",
    "Case documentation current in Project V.I.P.E.R.",
  ]),
  callout(
    "You are not on your own after this",
    "Your Project V.I.P.E.R. license is lifetime, your course notes stay " +
      "available, and the course discussion stays open. Bring us your next case.",
    "success"
  ),
];

const VIPER_BLOCKS = [
  heading("Your Project V.I.P.E.R. License", "INCLUDED WITH ENROLLMENT"),
  rich(
    "Every attendee receives a **free lifetime Project V.I.P.E.R. license — a " +
      "$600 value** — plus a 500 GB hard drive with V.I.P.E.R. pre-installed and " +
      "pre-registered to you, shipped before class so you can work from Day 1."
  ),
  callout(
    "What V.I.P.E.R. does for an ICAC case",
    "Parse warrant returns, author warrants, compile operations plans, track " +
      "deadlines and pending process, and integrate third-party intelligence " +
      "platforms — all in one case file. We use it live throughout all three days.",
    "note"
  ),
  checklist("Getting set up", [
    "Drive received",
    "V.I.P.E.R. launched and license confirmed as registered",
    "First case created",
    "Enrolled in the Project V.I.P.E.R. course on this platform",
  ]),
  rich(
    "Full platform training lives in the dedicated **Project V.I.P.E.R.** course, " +
      "which is included with your enrollment. Shipping questions or a drive that " +
      "did not arrive? Email [justin@intellect-le.com](mailto:justin@intellect-le.com)."
  ),
];

async function main() {
  const existing = await prisma.course.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Course "${SLUG}" already exists (id=${existing.id}). Aborting.`);
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error("No ADMIN user found. Run the base seed first.");

  // --- Cover image
  let coverImage = null;
  try {
    const abs = path.join(UPLOAD_DIR, COVER_REL);
    const stat = await fs.stat(abs);
    const file = await prisma.fileUpload.create({
      data: {
        ownerUserId: admin.id,
        path: COVER_REL,
        filename: "cybertips-a-to-z-cover.svg",
        mimeType: "image/svg+xml",
        sizeBytes: stat.size,
        purpose: "course-cover",
      },
    });
    coverImage = `/api/files/${file.id}`;
  } catch (e) {
    console.warn(`Cover not registered (${e.message}).`);
  }

  const category = await prisma.category.upsert({
    where: { name: "ICAC Investigations" },
    update: {},
    create: { name: "ICAC Investigations" },
  });

  const course = await prisma.course.create({
    data: {
      title: "Cybertips A to Z",
      slug: SLUG,
      description: DESCRIPTION,
      coverImage,
      status: "PUBLISHED",
      audiences: ["LE"],
      isPrivate: false,
      pricing: "PAID",
      instructor: "Justin Moyer",
      trainingHours: 24,
      categoryId: category.id,
    },
  });

  // Pacific offsets: Oct 19 2026 is PDT (-07:00); Nov 9 and Dec 14 are PST
  // (-08:00). Stored with the correct offset so every learner sees 8:00 AM
  // Pacific converted to their own timezone.
  const days = [
    {
      title: "Day 1 — From CyberTip to Warrant",
      liveTitle: "Day 1 Live Session — October 19, 2026 · 8:00 AM Pacific",
      startsAt: "2026-10-19T08:00:00-07:00",
      notesTitle: "Day 1 — Course Notes",
      blocks: DAY1_BLOCKS,
    },
    {
      title: "Day 2 — Working the Returns",
      liveTitle: "Day 2 Live Session — November 9, 2026 · 8:00 AM Pacific",
      startsAt: "2026-11-09T08:00:00-08:00",
      notesTitle: "Day 2 — Course Notes",
      blocks: DAY2_BLOCKS,
    },
    {
      title: "Day 3 — Execution, Forensics, and Charging",
      liveTitle: "Day 3 Live Session — December 14, 2026 · 8:00 AM Pacific",
      startsAt: "2026-12-14T08:00:00-08:00",
      notesTitle: "Day 3 — Course Notes",
      blocks: DAY3_BLOCKS,
    },
  ];

  for (const [i, d] of days.entries()) {
    const section = await prisma.section.create({
      data: { courseId: course.id, title: d.title, order: i },
    });
    await prisma.unit.create({
      data: {
        sectionId: section.id,
        title: d.liveTitle,
        type: "LIVE_SESSION",
        order: 0,
        data: {
          teamsJoinUrl: TEAMS_URL,
          startsAt: d.startsAt,
          durationMin: 480,
          replayUrl: "",
        },
      },
    });
    await prisma.unit.create({
      data: {
        sectionId: section.id,
        title: d.notesTitle,
        type: "NOTES",
        order: 1,
        data: { version: 1, blocks: d.blocks },
      },
    });
  }

  // Bonus section
  const bonus = await prisma.section.create({
    data: { courseId: course.id, title: "Bonus — Project V.I.P.E.R.", order: 3 },
  });
  await prisma.unit.create({
    data: {
      sectionId: bonus.id,
      title: "Your Lifetime Project V.I.P.E.R. License",
      type: "NOTES",
      order: 0,
      data: { version: 1, blocks: VIPER_BLOCKS },
    },
  });

  console.log(`Created "${course.title}" (id=${course.id}, slug=${course.slug})`);
  console.log(`  cover: ${coverImage ?? "none"}`);
  console.log(`  status: PUBLISHED / PAID  ·  audience: LE  ·  24 training hours`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
