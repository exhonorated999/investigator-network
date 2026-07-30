// One-off builder for the DATAPILOT X / DP10 Essentials course.
// Idempotent: re-running replaces the sections/units, keeps the course row.
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

const SLUG = "datapilot-dpx-dp10-essentials";

/** Live class dates, PST. Rebuilt monthly. */
const LIVE = [
  "2026-07-03T08:00:00-07:00",
  "2026-07-10T08:00:00-07:00",
  "2026-07-20T08:00:00-07:00",
  "2026-07-31T08:00:00-07:00",
];

const ONDEMAND = [
  ["Overview", 126],
  ["What's in the Box", 309],
  ["Updating Software", 148],
  ["Features", 253],
  ["Setting Up Android Devices", 284],
  ["Setting Up iOS Devices", 482],
  ["Creating a Case", 241],
  ["Acquire Data", 471],
  ["Saving Cases", 191],
  ["On-Demand Replay", 4848],
];

function liveTitle(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
  const time = d
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Los_Angeles",
    })
    .replace(":", "");
  return `${date} @ ${time} PST`;
}

const NOTES_INTRO = `## Welcome

Take a moment to introduce yourself to the instructor and the rest of the class.

**Tell us:**

- Your name and the agency you work for
- Your role and how long you have been in it
- What kind of device examinations you handle day to day
- Which DataPilot model you are working with (DPX or DP10)
- One thing you want to walk away from this class able to do

There is no wrong answer here. The instructor uses these to tailor the
hands-on portions of the class to the devices your unit actually sees.`;

const NOTES_COURSE = `## DataPilot X / DP10 Essentials — Course Notes

These notes are yours to keep. Come back to them any time; they are updated
as the DataPilot software changes.

### Quick reference

| Task | Where |
| --- | --- |
| Update software | Settings → System → Check for Updates |
| Create a case | Home → New Case |
| Acquire data | Case → Acquire → select device |
| Save / export | Case → Save, then export to USB |

### Before you start an acquisition

1. Confirm the device is charged or connected to power.
2. Document the device state — powered on, locked, airplane mode.
3. Place the device in a Faraday bag if it is not already isolated.
4. Confirm your legal authority for the acquisition is on file.

### Setting up Android devices

- Enable Developer Options: Settings → About Phone → tap Build Number 7×.
- Turn on USB Debugging.
- Accept the RSA fingerprint prompt on the handset when it appears.
- If the prompt does not appear, change the USB mode to File Transfer.

### Setting up iOS devices

- Unlock the device and tap **Trust** on the pairing prompt.
- The device passcode is required at the trust step; there is no way around it.
- Disable Auto-Lock for the length of the acquisition.
- If pairing fails, reset Location & Privacy on the handset and pair again.

### Saving and exporting cases

- Save to internal storage first, then export.
- Export to an exhibit-labelled USB drive, never to a shared drive.
- Hash values are written into the report automatically — do not edit the
  report file after export or the hash will no longer match.

### Common issues

**Device not detected.** Try a different cable first. Most detection
failures are cable failures.

**Acquisition stalls partway.** Check that the screen has not locked. Reset
Auto-Lock and restart the acquisition.

**Software update fails.** Confirm the unit is on a network that allows
outbound HTTPS. Agency networks frequently block it.

---

*Questions after class? Contact your instructor through the Investigator
Network message centre.*`;

async function main() {
  const category = await prisma.category.upsert({
    where: { name: "Digital Forensics" },
    create: { name: "Digital Forensics" },
    update: {},
  });

  const course = await prisma.course.upsert({
    where: { slug: SLUG },
    create: {
      slug: SLUG,
      title: "DataPilot X / DP10 Essentials",
      description:
        "Mobile forensic evidence acquisition and analysis on the DataPilot DPX and DP10. Attend a live instructor-led session over Microsoft Teams, or work through the same material at your own pace on demand. Course notes stay available to you for reference after class.",
      coverImage: "/course-covers/datapilot-dpx-essentials.png",
      status: "PUBLISHED",
      categoryId: category.id,
    },
    update: {
      title: "DataPilot X / DP10 Essentials",
      coverImage: "/course-covers/datapilot-dpx-essentials.png",
      status: "PUBLISHED",
      categoryId: category.id,
    },
  });

  // Rebuild the outline from scratch so the script stays idempotent.
  await prisma.section.deleteMany({ where: { courseId: course.id } });

  // 01 — Introduction
  await prisma.section.create({
    data: {
      courseId: course.id,
      title: "Introduction",
      order: 0,
      units: {
        create: [
          {
            title: "Course Introduction",
            type: "VIDEO",
            order: 0,
            data: { provider: "bunny", videoId: "", libraryId: "", durationSec: 238 },
          },
          {
            title: "Personal Introductions",
            type: "NOTES",
            order: 1,
            data: { contentMarkdown: NOTES_INTRO },
          },
        ],
      },
    },
  });

  // 02 — Live instructor led
  await prisma.section.create({
    data: {
      courseId: course.id,
      title: "Live Instructor Led Online Training",
      order: 1,
      units: {
        create: LIVE.map((iso, i) => ({
          title: liveTitle(iso),
          type: "LIVE_SESSION",
          order: i,
          data: {
            teamsJoinUrl: "",
            startsAt: iso,
            durationMin: 240,
            replayUrl: "",
          },
        })),
      },
    },
  });

  // 03 — On demand
  await prisma.section.create({
    data: {
      courseId: course.id,
      title: "On Demand and Self-Paced Training",
      order: 2,
      units: {
        create: [
          ...ONDEMAND.map(([title, durationSec], i) => ({
            title,
            type: "VIDEO",
            order: i,
            data: { provider: "bunny", videoId: "", libraryId: "", durationSec },
          })),
          {
            title: "Course Notes",
            type: "NOTES",
            order: ONDEMAND.length,
            data: { contentMarkdown: NOTES_COURSE },
          },
        ],
      },
    },
  });

  // 04 — Certificate
  await prisma.section.create({
    data: {
      courseId: course.id,
      title: "Certificate of Completion",
      order: 3,
      units: {
        create: [
          {
            title: "Certificate of Completion",
            type: "CERTIFICATE",
            order: 0,
            data: { templateId: "default" },
          },
        ],
      },
    },
  });

  const built = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { units: { orderBy: { order: "asc" } } },
      },
    },
  });

  console.log(`COURSE ${built.title} (${built.slug}) [${built.status}]`);
  for (const s of built.sections) {
    console.log(`  ${String(s.order + 1).padStart(2, "0")} ${s.title}`);
    for (const u of s.units) console.log(`      - ${u.title}  [${u.type}]`);
  }
  console.log(`ADMIN /admin/courses/${built.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
