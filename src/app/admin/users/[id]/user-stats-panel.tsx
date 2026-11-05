import Link from "next/link";
import type { UserStats } from "@/lib/user-stats";
import { formatDuration } from "@/lib/user-stats-calc";

function Stat({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="border border-border bg-background px-4 py-3">
      <div className="eyebrow eyebrow-muted text-[10px]">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${gold ? "text-gold" : "text-accent-bright"}`}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 font-mono text-[10px] text-muted">{sub}</div> : null}
    </div>
  );
}

const fmtDay = (k: string | null) =>
  k ? new Date(k + "T12:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

function ago(d: Date | null): string {
  if (!d) return "Never";
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.round(h / 24);
  return days < 30 ? `${days} day${days === 1 ? "" : "s"} ago` : d.toLocaleDateString();
}

export function UserStatsPanel({
  stats: s,
  lastSeenAt,
  lastSeenPath,
}: {
  stats: UserStats;
  lastSeenAt: Date | null;
  lastSeenPath: string | null;
}) {
  const maxDay = Math.max(...s.daily.map((d) => d.seconds), 1);
  const maxCourse = s.perCourse[0]?.seconds || 1;
  const last30 = s.daily.reduce((a, d) => a + d.seconds, 0);

  return (
    <section className="panel mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Activity &amp; engagement</h2>
        <span className="font-mono text-[11px] text-muted">
          Last seen: <span className="text-foreground">{ago(lastSeenAt)}</span>
          {lastSeenPath ? <span className="opacity-70"> · {lastSeenPath}</span> : null}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Time on site" value={formatDuration(s.siteSeconds)} sub={`${formatDuration(last30)} in last 30 days`} />
        <Stat label="Time in courses" value={formatDuration(s.courseSeconds)} sub={`${s.perCourse.length} course${s.perCourse.length === 1 ? "" : "s"} visited`} />
        <Stat label="Active days" value={String(s.activeDays)} sub={`${s.activeDaysLast30} in last 30 · best streak ${s.longestStreak}`} />
        <Stat label="Avg per active day" value={formatDuration(s.avgSecondsPerActiveDay)} sub={`since ${fmtDay(s.firstActiveDay)}`} />
        <Stat label="Lessons completed" value={s.lessonsCompleted.toLocaleString()} sub={s.lastLessonAt ? `last ${s.lastLessonAt.toLocaleDateString()}` : "none yet"} />
        <Stat
          label="Quizzes"
          value={s.quizAttempts ? `${s.quizPassed}/${s.quizAttempts}` : "—"}
          sub={s.quizAvgScore != null ? `passed · avg score ${s.quizAvgScore}%` : "no attempts"}
        />
        <Stat
          label="Lab exercises"
          value={s.submissions ? `${s.submissionsPassed}/${s.submissions}` : "—"}
          sub={s.submissions ? "passed / submitted" : "none submitted"}
        />
        <Stat label="Certificates" value={String(s.certificates)} gold sub={`${s.communityPosts + s.boardPosts} posts · ${s.messagesSent} messages`} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {/* Most visited + per-course breakdown */}
        <div className="border border-border bg-background p-4">
          <div className="eyebrow eyebrow-muted text-[10px]">Most visited course</div>
          {s.mostVisited ? (
            <>
              <Link
                href={`/courses/${s.mostVisited.slug}`}
                className="mt-1 block font-display text-base font-semibold text-foreground hover:text-accent-bright"
              >
                {s.mostVisited.title}
              </Link>
              <div className="font-mono text-[11px] text-muted">
                {formatDuration(s.mostVisited.seconds)} · {Math.round(s.mostVisited.share * 100)}% of course time
              </div>
              <div className="mt-3 grid gap-2">
                {s.perCourse.slice(0, 6).map((p) => (
                  <div key={p.courseId} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                    <span className="truncate text-[12px] text-foreground">
                      {s.courseTitles[p.courseId]?.title ?? "Deleted course"}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {formatDuration(p.seconds)} · {p.days}d
                    </span>
                    <div className="col-span-2 h-[5px] overflow-hidden bg-[rgba(127,127,127,0.15)]">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-accent-bright"
                        style={{ width: `${Math.max(3, (p.seconds / maxCourse) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-muted">No course time recorded yet.</p>
          )}
        </div>

        {/* Last 30 days */}
        <div className="border border-border bg-background p-4">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow eyebrow-muted text-[10px]">Last 30 days</span>
            <span className="font-mono text-[10px] text-muted">minutes on site per day</span>
          </div>
          <div className="mt-3 flex h-32 items-end gap-[3px]">
            {s.daily.map((d) => (
              <div
                key={d.day}
                title={`${fmtDay(d.day)}: ${formatDuration(d.seconds)}`}
                className={`flex-1 ${d.seconds ? "bg-gradient-to-t from-accent to-accent-bright" : "bg-[rgba(127,127,127,0.15)]"}`}
                style={{ height: d.seconds ? `${Math.max(6, (d.seconds / maxDay) * 100)}%` : "3px" }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
            <span>{fmtDay(s.daily[0]?.day ?? null)}</span>
            <span>Today</span>
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
            Active, on-screen time only (idle tabs excluded). Course time since Aug 2026; site-wide time since Nov 5, 2026
            (earlier days count course time only).
          </p>
        </div>
      </div>
    </section>
  );
}
