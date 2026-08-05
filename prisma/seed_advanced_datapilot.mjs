/**
 * Seed / rebuild the "Advanced Datapilot" course.
 *
 * Private (unlisted) course — admins manually enroll learners. Available to
 * both LE and CIVILIAN. Instructor Justin Moyer, 8 training hours. Structure:
 *
 *   1. Introduction & Course Materials      (NOTES: flipbook + downloads + FAQ)
 *   2. Morning Session                       (LIVE_SESSION + 3 CTF assignments)
 *   3. Afternoon Session                     (LIVE_SESSION + 3 CTF assignments)
 *   4. Final Test                            (QUIZ: 19 MC + 4 upload, pass 75%)
 *
 * The test is locked (see lib/gating.ts) until all 6 capture-the-flag
 * assignments are complete. The certificate auto-issues once every unit —
 * including the admin-graded test at ≥75% — is complete.
 *
 * Idempotent: deletes any existing course with this slug and rebuilds it.
 * Learner enrollments/progress on the old copy are removed with it, so only run
 * a rebuild before anyone is enrolled.
 *
 *   node prisma/seed_advanced_datapilot.mjs
 */
import pkg from "../src/generated/prisma/index.js";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const SLUG = "advanced-datapilot";

// --- block id helper (unique within one NOTES document) --------------------
let n = 0;
const bid = () => `b${Date.now().toString(36)}${(n++).toString(36)}`;

// --- links -----------------------------------------------------------------
const LINKS = {
  flipbook: "https://heyzine.com/flip-book/2d9f1b5708.html",
  projectViper: "https://www.project-viper.com",
  dpScout: "https://www.dpscout.com",
  betaDesktop:
    "https://netorgft13969570-my.sharepoint.com/:u:/g/personal/justin_intellect-le_com/IQDsFpfYVaVfTLmsS8kxAuTZARev7Lpej4ze0AitIebbghU?e=r9hSNY",
  androidSample:
    "https://netorgft13969570-my.sharepoint.com/:u:/g/personal/justin_intellect-le_com/IQD2SWoaWWmISoURri0mri0VAeRb4-l35wgpfJNlCZyUV-0?e=fJ4wOs",
  metaWarrant:
    "https://netorgft13969570-my.sharepoint.com/:u:/g/personal/justin_intellect-le_com/IQBboCSW-dzdRKQZlI9l4naBAeQ3-8drATJd3lc9gJbbkcQ?e=TzLejW",
  morningTeams: "https://teams.microsoft.com/meet/261360650429657?p=1DanzF7zw4VNoeIkde",
  afternoonTeams: "https://teams.microsoft.com/meet/25105180503081?p=tDodnQUnWqUQ2QLq0E",
  // Mon Aug 31 2026. 08:30 Pacific = 15:30 UTC; 11:30 Pacific = 18:30 UTC.
  // (August → Pacific Daylight Time, UTC-7.) Stored as absolute instants so the
  // start time renders correctly in each learner's own timezone.
  morningStart: "2026-08-31T15:30:00.000Z",
  afternoonStart: "2026-08-31T18:30:00.000Z",
};

// --- NOTES document --------------------------------------------------------
const notesDoc = {
  version: 1,
  blocks: [
    {
      id: bid(),
      type: "callout",
      variant: "note",
      title: "Welcome to Advanced Datapilot",
      markdown:
        "This course is designed to help you get the most out of the Datapilot ecosystem. It runs as one day of live instruction (morning and afternoon Microsoft Teams sessions) with hands-on **capture-the-flag** workshops, followed by a take-home test you have one week to complete. Pass the test at **75% or better** to download your certificate (8 training hours).",
    },
    {
      id: bid(),
      type: "heading",
      level: 2,
      eyebrow: "01 / PRESENTATION",
      text: "Course notes & slides",
    },
    {
      id: bid(),
      type: "richText",
      markdown:
        "The full course presentation is embedded below — HDMI extractions, acquiring data, types of mobile extractions, the Techno Data Kit, custom consent-to-search forms, and DP10 vs. Datapilot Desktop. Flip through it before and during the live sessions.",
    },
    {
      id: bid(),
      type: "embed",
      url: LINKS.flipbook,
      title: "Advanced Datapilot — course presentation",
      height: 720,
    },
    {
      id: bid(),
      type: "heading",
      level: 2,
      eyebrow: "02 / MATERIALS",
      text: "Free software downloads",
    },
    {
      id: bid(),
      type: "richText",
      markdown:
        "These tools are free for the class. Register with your work email on download — no purchase or license needed. If your I.T. department restricts installs, download at home to a thumb drive and bring it in.",
    },
    {
      id: bid(),
      type: "fileList",
      title: "Software",
      items: [
        {
          id: bid(),
          url: LINKS.projectViper,
          label: "Project VIPER",
          description:
            "Case-management + analytics platform built by head instructor Justin Moyer. Free 60-day trial, local storage, runs from a USB drive. Used to demonstrate importing Datapilot reports into third-party tools.",
          meta: "project-viper.com",
        },
        {
          id: bid(),
          url: LINKS.dpScout,
          label: "Datapilot Scout",
          description:
            "Triage tool for scanning Windows, USB, Android, iOS, and warrant returns. Download the DESKTOP version for the class (Android/iOS/warrant scanning). Free 60-day trial.",
          meta: "dpscout.com",
        },
        {
          id: bid(),
          url: LINKS.betaDesktop,
          label: "Beta Datapilot Desktop (Analysis)",
          description:
            "New beta Datapilot Desktop analysis build. The free report-viewer feature is used for the capture-the-flag assignments and the test.",
          meta: "OneDrive · beta build",
        },
      ],
    },
    {
      id: bid(),
      type: "heading",
      level: 2,
      eyebrow: "03 / SAMPLE DATA",
      text: "Sample data for the workshops",
    },
    {
      id: bid(),
      type: "callout",
      variant: "evidence",
      title: "Used in the capture-the-flag assignments",
      markdown:
        "These datasets are sanitized — no real case data — and safe to use at home or the office. You'll load them into your Datapilot tools and Project VIPER during the assignments below.",
    },
    {
      id: bid(),
      type: "fileList",
      title: "Sample data",
      items: [
        {
          id: bid(),
          url: LINKS.androidSample,
          label: "Android Sample Data (Datapilot Extraction)",
          description:
            "Android extraction used for the Project VIPER import, keyword-search, and hash-search assignments.",
          meta: "OneDrive",
        },
        {
          id: bid(),
          url: LINKS.metaWarrant,
          label: "Meta Warrant Return (Sample)",
          description:
            "Sample Meta warrant return — parse it with Datapilot Scout in the morning assignment.",
          meta: "OneDrive",
        },
      ],
    },
    {
      id: bid(),
      type: "accordion",
      title: "Frequently asked questions",
      exclusive: false,
      items: [
        {
          id: bid(),
          title: "How long is the course?",
          open: true,
          blocks: [
            {
              id: bid(),
              type: "richText",
              markdown:
                "One day — approximately 4–5 hours of live instruction with workshops mixed in. After the live day you have **1 week** to complete the take-home test.",
            },
          ],
        },
        {
          id: bid(),
          title: "Will there be a test?",
          open: false,
          blocks: [
            {
              id: bid(),
              type: "richText",
              markdown:
                "Yes — a written test plus a practical demonstration of skills using Datapilot Analysis (the four upload questions). You have one week, can take it as many times as you need, and must pass with **75% or better**.",
            },
          ],
        },
        {
          id: bid(),
          title: "Will there be a certificate?",
          open: false,
          blocks: [
            {
              id: bid(),
              type: "richText",
              markdown:
                "Yes. Once you've completed the assignments and passed the written + practical test, your certificate (with your name, instructor, date, and 8 training hours) is available to download from the course page.",
            },
          ],
        },
      ],
    },
  ],
};

// --- capture-the-flag prompts ----------------------------------------------
const IMG_PDF = ".pdf,.png,.jpg,.jpeg";
const IMG_PDF_TXT = ".pdf,.png,.jpg,.jpeg,.txt";

const morningCtf = [
  {
    title: "CTF 1 — Evidence report via HDMI / Optical Capture",
    prompt:
      "Create an evidence report using HDMI capture. If you do NOT have a sample phone, use the Optical Capture feature and take a couple of photos/videos of anything you like (computer, cell, etc). Select 2 screenshots and 1 short video. Create a PDF report and upload it below.",
    allowedFileTypes: IMG_PDF,
  },
  {
    title: "CTF 2 — Parse the Meta warrant return (Datapilot Scout)",
    prompt:
      "Using Datapilot Scout, parse the sample Meta warrant return found in your Introduction Notes. Export the parsed report and upload a screenshot of the report displayed in your browser.",
    allowedFileTypes: IMG_PDF,
  },
  {
    title: "CTF 3 — Update the DP10 / DPX consent-to-search form",
    prompt:
      "If you use Datapilot 10 / DPX, update the consent-to-search form as discussed in class and take a picture of the updated form and upload it below. If you do not use the handheld Datapilots, just add a short note (upload a .txt) saying so and submit.",
    allowedFileTypes: IMG_PDF_TXT,
  },
];

const afternoonCtf = [
  {
    title: "CTF 4 — Android data into Project VIPER (3 flags)",
    prompt:
      "Import the Android sample dataset provided in the Introduction section into Project VIPER. Review the report inside VIPER and generate a PDF report with 3 evidence flags. Upload the PDF below.",
    allowedFileTypes: IMG_PDF,
  },
  {
    title: "CTF 5 — Hash search list (Full Desktop license only)",
    prompt:
      "Create a hash search list with the following hashes (only if you have a full Desktop license):\n\n" +
      "df295e802301e404aa83b11cfbd058d893e4b85d836057b084b0d7641d0bb542\n" +
      "778239baaecb29da939ad9db3df5b884924e1e5985f7332a00b10c87c2d7d9bd\n" +
      "e35f2c3c07fb43cf9ae40c1e99141837fda9b3a20846ed6079d674a54d1b0561\n\n" +
      "Upload the dataset and search for the hashes. Flag all of the hits and create a PDF report. Screenshot the result and upload it below. If you do not have a full Desktop license, upload a short .txt note saying so.",
    allowedFileTypes: IMG_PDF_TXT,
  },
  {
    title: "CTF 6 — Cell-phone extraction into Project VIPER",
    prompt:
      "Using Datapilot, create a cell-phone extraction (a Flex Content or a Fast Acquisition). Take that extraction and upload it into Project VIPER, then either take a screenshot and upload it below, or generate a VIPER PDF report with a couple of flags and upload the report below.",
    allowedFileTypes: IMG_PDF,
  },
];

// --- TEST questions --------------------------------------------------------
// mc(prompt, [[text, correct], ...])
const mc = (prompt, choices) => ({ type: "MULTIPLE_CHOICE", prompt, choices });
const ms = (prompt, choices) => ({
  type: "MULTIPLE_CHOICE",
  prompt,
  choices,
  multiSelect: true,
});
const tf = (prompt, answer) =>
  mc(prompt, [
    ["True", answer === true],
    ["False", answer === false],
  ]);
const upload = (prompt) => ({ type: "DOCUMENT_UPLOAD", prompt, choices: [] });

const testQuestions = [
  mc(
    "When conducting an extraction on an Android cell phone and the device requests you to password protect the backup, what password should you put into the phone?",
    [
      ["The password for the cell phone", false],
      ["911", false],
      ["the number 1", true],
      ["Any password you want", false],
    ]
  ),
  tf(
    "True or False: you can upload your Datapilot extractions into other tools such as Autopsy Forensics and more.",
    true
  ),
  mc(
    "What is the main difference between conducting a linked-screen extraction on an iPhone vs an Android device?",
    [
      ["OCR does not work on Android devices", false],
      ["Apple devices need to employ the accessibility features for auto scroll", true],
      ["Auto Scroll does not work on Apple devices", false],
      ["OCR does not work on Apple devices", false],
    ]
  ),
  mc(
    "You are attempting to conduct a linked-screen acquisition on an Apple iPhone running iOS 17. You plug in your lightning-to-HDMI connector and then the HDMI to the capture card and back to your Datapilot, but it still will not recognize the device. What is the most likely problem?",
    [
      ["Your Datapilot needs an update", false],
      ["The phone needs a firmware update from Apple to use the lightning-to-HDMI adapter", true],
      ["You need a Techno Data Kit license", false],
      ["I hate iPhones, should have bought an Android", false],
    ]
  ),
  tf(
    "True or False: manually searching a cell phone at any time will change/alter date and time stamp logs on the device.",
    true
  ),
  tf(
    "True or False: you can still manually search your target device while an extraction is processing.",
    true
  ),
  tf(
    "True or False: the Datapilot will charge your target device while still extracting data.",
    true
  ),
  ms(
    "What are the additional add-on features for Datapilot and Datapilot 10 / DPX? (Select all that apply.)",
    [
      ["Techno Data Kit (for external USB and hard drives)", true],
      ["Datapilot Scout (for scanning devices for Child Sexual Abuse Material)", true],
      ["Techno Cable Kit (for HDMI linked-screen features)", true],
    ]
  ),
  mc(
    "What is the main feature difference between Datapilot Desktop and Datapilot 10 / DPX?",
    [
      ["Datapilot 10 cannot extract from hard drives", false],
      ["Additional analysis features such as Link Graph and Geo", true],
      ["Datapilot Desktop supports Apple products", false],
      ["Cyacomb is only available on Datapilot Desktop", false],
    ]
  ),
  mc(
    "You are with a narcotics team conducting a Knock & Talk at a residence with 3 subjects inside who may be involved. They all consented to searches of their devices — what is the most effective and efficient way to extract evidence while on scene so you can review the data later and hopefully find a common link?",
    [
      ["Flex Specific File", false],
      ["Fast Acquisition", true],
      ["Flex Content Type", false],
      ["Linked Screen", false],
    ]
  ),
  tf(
    "True or False: the built-in Consent to Search form on the Datapilot 10 can NOT be modified.",
    false
  ),
  mc("How often does Datapilot update your software?", [
    ["Monthly", true],
    ["Quarterly", false],
    ["Twice a month", false],
    ["Annually at renewal", false],
  ]),
  mc(
    "What is the password to the Datapilot 10 out of the box? (Hint: pay attention to capitals)",
    [
      ["Protect", false],
      ["PROTECT", false],
      ["protect", true],
    ]
  ),
  mc("Which device can you conduct an extraction over wifi with?", [
    ["Android Tablet", false],
    ["Android Watches (Wear OS)", true],
    ["Apple Watches", false],
    ["Android Cell Phones", false],
  ]),
  tf(
    "True or False: You need a password to conduct an extraction with Datapilot.",
    true
  ),
  mc("Which dataset is NOT available for a Fast Acquisition on an iOS cell phone?", [
    ["Call History", true],
    ["Contacts", false],
    ["Text Messages", false],
  ]),
  ms(
    "Which features are available for iOS cell phone/tablet extractions? (Select all that apply.)",
    [
      ["Linked Screen", true],
      ["Datapilot Share", false],
      ["Flex Content Type", true],
      ["Fast Acquisition", true],
    ]
  ),
  tf("True or False: Datapilot can root a cell phone.", false),
  mc("What type of extraction does the Datapilot 10 perform?", [
    ["Full File System (FFS)", false],
    ["Logical", false],
    ["Advanced Logical", true],
  ]),
  // --- 4 practical upload questions ---
  upload(
    "Create an extraction using the HDMI-to-USB capture card. You can use this on a gaming device (Xbox, Nintendo) or on a laptop/Chromebook. Take several screenshots/recordings and upload them into the Datapilot Desktop Analysis tool. Flag 3 pieces of evidence and make comments on all 3. Create a PDF report and upload it below. Or, if you are using the new Beta version, take a screenshot with the Windows Snipping Tool of your analysis screen with flags and upload it."
  ),
  upload(
    "Create a keyword search list (or search) for the following keywords: Apple, Jumbalaya, Drugs, Team, Softball. Upload your search list into Datapilot Desktop and run it against the Android sample data. Flag all the evidence the keywords hit on and create a PDF report. Upload your report below."
  ),
  upload(
    "Utilizing a sample phone, conduct a Fast Acquisition. Upload it into Datapilot Desktop. Flag 3 pieces of evidence with 2 comments. Generate an HTML report, take a screenshot of it, and upload it to show your work."
  ),
  upload(
    "Conduct an extraction using Datapilot Share (Android only). Choose a couple of photos/videos or additional shareable files from a practice phone. Create a report and upload it below. If you don't have access to an Android phone, conduct a Flex Specific File extraction and create a report — upload the PDF report below."
  ),
];

// ---------------------------------------------------------------------------
async function main() {
  await prisma.course.deleteMany({ where: { slug: SLUG } });

  const course = await prisma.course.create({
    data: {
      title: "Advanced Datapilot",
      slug: SLUG,
      description:
        "Advanced, hands-on Datapilot training. One day of live instruction (morning and afternoon Microsoft Teams sessions) with capture-the-flag workshops, followed by a take-home written + practical test. Pass at 75% or better to earn your certificate. Instructor: Justin Moyer · 8 training hours.",
      status: "PUBLISHED",
      isPrivate: true, // unlisted — admins enroll learners manually
      audiences: ["LE", "CIVILIAN"],
      pricing: "FREE",
      instructor: "Justin Moyer",
      trainingHours: 8,
    },
  });

  // --- Section 1: Introduction ---
  const intro = await prisma.section.create({
    data: { courseId: course.id, title: "Introduction & Course Materials", order: 0 },
  });
  await prisma.unit.create({
    data: {
      sectionId: intro.id,
      title: "Introduction & Course Notes",
      type: "NOTES",
      order: 0,
      data: notesDoc,
    },
  });

  // --- Section 2: Morning ---
  const morning = await prisma.section.create({
    data: { courseId: course.id, title: "Morning Session", order: 1 },
  });
  await prisma.unit.create({
    data: {
      sectionId: morning.id,
      title: "Live Session — Morning (Microsoft Teams)",
      type: "LIVE_SESSION",
      order: 0,
      data: {
        teamsJoinUrl: LINKS.morningTeams,
        startsAt: LINKS.morningStart,
        durationMin: 180,
        replayUrl: "",
      },
    },
  });
  let order = 1;
  for (const a of morningCtf) {
    await prisma.unit.create({
      data: {
        sectionId: morning.id,
        title: a.title,
        type: "FILE_ASSIGNMENT",
        order: order++,
        data: { prompt: a.prompt, allowedFileTypes: a.allowedFileTypes },
      },
    });
  }

  // --- Section 3: Afternoon ---
  const afternoon = await prisma.section.create({
    data: { courseId: course.id, title: "Afternoon Session", order: 2 },
  });
  await prisma.unit.create({
    data: {
      sectionId: afternoon.id,
      title: "Live Session — Afternoon (Microsoft Teams)",
      type: "LIVE_SESSION",
      order: 0,
      data: {
        teamsJoinUrl: LINKS.afternoonTeams,
        startsAt: LINKS.afternoonStart,
        durationMin: 180,
        replayUrl: "",
      },
    },
  });
  order = 1;
  for (const a of afternoonCtf) {
    await prisma.unit.create({
      data: {
        sectionId: afternoon.id,
        title: a.title,
        type: "FILE_ASSIGNMENT",
        order: order++,
        data: { prompt: a.prompt, allowedFileTypes: a.allowedFileTypes },
      },
    });
  }

  // --- Section 4: Final Test ---
  const examSection = await prisma.section.create({
    data: { courseId: course.id, title: "Final Test", order: 3 },
  });
  const testUnit = await prisma.unit.create({
    data: {
      sectionId: examSection.id,
      title: "Advanced Datapilot — Final Test",
      type: "QUIZ",
      order: 0,
      data: {},
    },
  });
  const quiz = await prisma.quiz.create({
    data: {
      unitId: testUnit.id,
      title: "Advanced Datapilot — Final Test",
      passScore: 75,
    },
  });

  let qorder = 0;
  for (const q of testQuestions) {
    const question = await prisma.question.create({
      data: {
        quizId: quiz.id,
        type: q.type,
        prompt: q.prompt,
        order: qorder++,
        points: 1,
        multiSelect: q.multiSelect ?? false,
      },
    });
    let corder = 0;
    for (const [text, correct] of q.choices) {
      await prisma.choice.create({
        data: {
          questionId: question.id,
          text,
          isCorrect: correct,
          // order isn't a column on Choice; text order is authored order.
        },
      });
      corder++;
    }
  }

  // --- report ---
  const full = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { units: { orderBy: { order: "asc" } } },
      },
    },
  });
  console.log(`\nCreated "${full.title}" (/${full.slug})`);
  console.log(
    `  private=${full.isPrivate}  audiences=${full.audiences.join("+")}  pricing=${full.pricing}  instructor=${full.instructor}  hours=${full.trainingHours}\n`
  );
  for (const s of full.sections) {
    console.log(`  § ${s.title}`);
    for (const u of s.units) console.log(`      - [${u.type}] ${u.title}`);
  }
  const mcCount = testQuestions.filter((q) => q.type === "MULTIPLE_CHOICE").length;
  const upCount = testQuestions.filter((q) => q.type === "DOCUMENT_UPLOAD").length;
  console.log(
    `\n  Test: ${testQuestions.length} questions (${mcCount} multiple-choice + ${upCount} upload), pass ${quiz.passScore}%`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
