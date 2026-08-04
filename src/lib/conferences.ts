import { prisma } from "@/lib/prisma";
import { isAdmin, type AudienceViewer } from "@/lib/audience";
import type { Prisma } from "@/generated/prisma";

/** Audience gate for conferences: admins see all; learners see their side or shared (null). */
function audienceWhere(viewer: AudienceViewer): Prisma.ConferenceWhereInput {
  if (isAdmin(viewer)) return {};
  return { OR: [{ audience: viewer.audience }, { audience: null }] };
}

/** Upcoming conferences for a viewer, audience-gated (admins see all). */
export async function loadUpcomingConferences(viewer: AudienceViewer, limit = 6) {
  return prisma.conference.findMany({
    where: {
      AND: [
        // Show events that haven't fully ended yet (end date, or start if none).
        {
          OR: [
            { endsAt: { gte: startOfToday() } },
            { endsAt: null, startsAt: { gte: startOfToday() } },
          ],
        },
        audienceWhere(viewer),
      ],
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
}

/** Every conference, newest-start first — for the admin management list. */
export async function loadAllConferences() {
  return prisma.conference.findMany({ orderBy: { startsAt: "asc" } });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
