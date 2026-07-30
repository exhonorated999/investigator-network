// Seeds a few starter Community posts so the feed isn't barren on first open.
// Idempotent: does nothing if any posts already exist. Safe to delete anytime;
// admins can also remove these from the UI (Hide / Delete).
import { PrismaClient } from "../src/generated/prisma/index.js";
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.post.count();
  if (existing > 0) {
    console.log(`Skipping — ${existing} post(s) already exist.`);
    return;
  }

  const users = await prisma.user.findMany({
    where: { status: "APPROVED" },
    orderBy: { role: "desc" }, // ADMIN first
    select: { id: true, role: true },
  });
  if (users.length === 0) throw new Error("no approved users to author posts");
  const staff = users.find((u) => u.role === "ADMIN") ?? users[0];
  const peer = users.find((u) => u.role !== "ADMIN") ?? users[0];

  const seed = [
    {
      topic: "DFIR",
      author: peer,
      body: "Pulled a locked Android (Pixel 7, Android 14) on a warrant. GrayKey isn't getting in. Anyone had luck with a different approach on recent Pixels, or is it a wait-for-consent situation?",
      answers: [
        {
          author: staff,
          body: "Recent Pixels with the Titan M2 are genuinely hard. Document the make/model/OS and preserve it powered-on in a Faraday bag. Don't attempt repeated unlocks — you can trip the wipe counter. Loop in your lab before anything else.",
          replies: [
            { author: peer, body: "Faraday bag it is. It came in powered off — leave it off then?" },
            { author: staff, body: "Yes, leave it off and note the state. Powering on can trigger updates or remote wipe if a SIM is present. Bag + isolate first." },
          ],
        },
      ],
      reactions: ["helpful", "insightful"],
    },
    {
      topic: "ICAC",
      author: staff,
      body: "Reminder for everyone working CyberTip referrals: preserve the NCMEC report and the original hash values before you do anything else. Chain of custody on the hash set is where these cases get won or lost.",
      answers: [
        { author: peer, body: "Do you record the hashes in the report narrative or keep them in a separate evidence log?" },
        { author: staff, body: "Separate evidence log, referenced by the report. Keep the tool's own export too — don't retype hashes by hand." },
      ],
      reactions: ["helpful", "thanks"],
    },
    {
      topic: "GENERAL",
      author: peer,
      body: "Building a financial timeline for a fraud case — bank records, Venmo, and one crypto wallet. What are folks using to pull it all into one view without a $$$ analytics license?",
      answers: [
        { author: staff, body: "A clean spreadsheet with a normalized date + amount + counterparty schema goes a long way. For the wallet, note the chain and export the transaction list from a block explorer as CSV." },
      ],
      reactions: ["insightful"],
    },
    {
      topic: "GENERAL",
      author: staff,
      body: "New here — introduce yourself in a reply: agency, focus area, and one thing you're hoping to get better at this year. Good place to find people to bounce cases off.",
      answers: [],
      reactions: ["thanks"],
    },
  ];

  for (const p of seed) {
    const post = await prisma.post.create({
      data: { authorId: p.author.id, topic: p.topic, body: p.body },
    });
    for (const k of p.reactions) {
      // React as whichever user did NOT author the post.
      const reactor = p.author.id === staff.id ? peer : staff;
      await prisma.postReaction.create({
        data: { userId: reactor.id, kind: k, postId: post.id },
      });
    }
    for (const a of p.answers) {
      const comment = await prisma.postComment.create({
        data: { postId: post.id, authorId: a.author.id, body: a.body },
      });
      for (const r of a.replies ?? []) {
        await prisma.postComment.create({
          data: {
            postId: post.id,
            authorId: r.author.id,
            parentId: comment.id,
            body: r.body,
          },
        });
      }
    }
  }

  const [posts, comments] = await Promise.all([
    prisma.post.count(),
    prisma.postComment.count(),
  ]);
  console.log(`Seeded ${posts} posts and ${comments} comments/replies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
