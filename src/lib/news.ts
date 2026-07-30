/**
 * Curated news feed. Admins paste articles (link, or link + pasted body) and
 * tag each one with a topic — the same `Category` table that classifies
 * courses, so the taxonomy stays in one place.
 *
 * Learner subscriptions live in `DashboardPref.newsTopics`. An empty array
 * means "follow everything", so newly created topics surface automatically
 * instead of silently going unread.
 */
import { prisma } from "@/lib/prisma";

export interface FeedArticle {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  publishedAt: Date;
  /** True when the admin pasted article text, so we can read it in-app. */
  hasBody: boolean;
}

export interface Topic {
  id: string;
  name: string;
  count: number;
}

/** Category ids the learner follows. `[]` means every topic. */
export async function loadNewsTopics(userId: string): Promise<string[]> {
  const pref = await prisma.dashboardPref.findUnique({
    where: { userId },
    select: { newsTopics: true },
  });
  const raw = Array.isArray(pref?.newsTopics)
    ? (pref!.newsTopics as unknown[])
    : [];
  return raw.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** Every topic that has at least one published article, plus its count. */
export async function loadTopics(): Promise<Topic[]> {
  const [categories, grouped] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.newsArticle.groupBy({
      by: ["categoryId"],
      where: { published: true },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(
    grouped
      .filter((g) => g.categoryId)
      .map((g) => [g.categoryId as string, g._count._all])
  );

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    count: counts.get(c.id) ?? 0,
  }));
}

function toFeed(a: {
  id: string;
  title: string;
  summary: string;
  body: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  categoryId: string | null;
  category: { name: string } | null;
  publishedAt: Date;
}): FeedArticle {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    sourceName: a.sourceName,
    sourceUrl: a.sourceUrl,
    imageUrl: a.imageUrl,
    categoryId: a.categoryId,
    categoryName: a.category?.name ?? null,
    publishedAt: a.publishedAt,
    hasBody: a.body.trim().length > 0,
  };
}

const SELECT = {
  id: true,
  title: true,
  summary: true,
  body: true,
  sourceName: true,
  sourceUrl: true,
  imageUrl: true,
  categoryId: true,
  publishedAt: true,
  category: { select: { name: true } },
} as const;

/**
 * Latest published articles in the learner's followed topics. When the learner
 * follows everything, uncategorised articles are included too; once they narrow
 * the list we only honour explicit topics so the card stays predictable.
 */
export async function loadNewsFeed(
  userId: string,
  limit = 6
): Promise<FeedArticle[]> {
  const topics = await loadNewsTopics(userId);
  const rows = await prisma.newsArticle.findMany({
    where: {
      published: true,
      ...(topics.length > 0 ? { categoryId: { in: topics } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: SELECT,
  });
  return rows.map(toFeed);
}

/** The full `/news` index, optionally narrowed to a single topic. */
export async function loadArticles(opts: {
  topicId?: string | null;
  limit?: number;
}): Promise<FeedArticle[]> {
  const rows = await prisma.newsArticle.findMany({
    where: {
      published: true,
      ...(opts.topicId ? { categoryId: opts.topicId } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: opts.limit ?? 60,
    select: SELECT,
  });
  return rows.map(toFeed);
}

export async function loadArticle(id: string) {
  return prisma.newsArticle.findFirst({
    where: { id, published: true },
    include: { category: { select: { name: true, id: true } } },
  });
}

/** Split pasted article text into paragraphs on blank lines. */
export function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** `example.com` from a full URL, for the source chip when none was given. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
