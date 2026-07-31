import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { Sparkline, BarChart, HBar, Donut } from "@/components/charts";
import {
  getSignupCounts,
  getActiveCounts,
  getSignupSeries,
  getSignupsByMonth,
  getCompletionSeries,
  getCourseEngagement,
  getPassRate,
  PERIOD_LABEL,
  type PeriodKey,
} from "@/lib/analytics";
import {
  getOnlineUsers,
  getCourseOccupancy,
  countOnline,
} from "@/lib/presence";

export const dynamic = "force-dynamic";

const PERIODS: PeriodKey[] = ["week", "month", "quarter", "year"];

export default async function AnalyticsPage() {
  await requireAdmin();

  const [
    signups,
    actives,
    signupSeries,
    signupsByMonth,
    completionSeries,
    engagement,
    passRate,
    online,
    occupancy,
    onlineCount,
  ] = await Promise.all([
    getSignupCounts(),
    getActiveCounts(),
    getSignupSeries(30),
    getSignupsByMonth(12),
    getCompletionSeries(30),
    getCourseEngagement(8),
    getPassRate(),
    getOnlineUsers(25),
    getCourseOccupancy(),
    countOnline(),
  ]);

  const maxOccupancy = occupancy.reduce((m, o) => Math.max(m, o.count), 0);
  const maxEnroll = engagement.reduce((m, e) => Math.max(m, e.enrollments), 0);

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// Intelligence</p>
      <h1 className="display-lg mt-2 text-foreground">Analytics</h1>
      <p className="mt-2 text-[15px] text-muted">
        Growth, engagement, and live activity across the platform.
      </p>

      {/* ---------------------------------------------------------------- */}
      {/* Live presence                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow eyebrow-gold">01 / Live</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Auto-refreshes on reload
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="panel rule-top p-5">
            <div className="flex items-baseline gap-3">
              <span className="relative flex h-2.5 w-2.5">
                {onlineCount > 0 ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                ) : null}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    onlineCount > 0 ? "bg-success" : "bg-border-strong"
                  }`}
                />
              </span>
              <span className="display-lg text-foreground">{onlineCount}</span>
              <span className="eyebrow eyebrow-muted">Online now</span>
            </div>

            <div className="mt-4 divide-y divide-border">
              {online.length === 0 ? (
                <p className="py-3 text-sm text-muted">
                  Nobody is online right now.
                </p>
              ) : (
                online.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        u.idle ? "bg-gold" : "bg-success"
                      }`}
                      title={u.idle ? "Idle" : "Active"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-foreground">
                        {u.name}
                        {u.role === "ADMIN" ? (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-accent-bright">
                            staff
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted">
                        {u.courseTitle
                          ? u.unitTitle
                            ? `${u.courseTitle} — ${u.unitTitle}`
                            : u.courseTitle
                          : (u.path ?? "—")}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {u.idle ? "idle" : "active"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel rule-top p-5">
            <p className="eyebrow eyebrow-muted">In course right now</p>
            <div className="mt-4 grid gap-3">
              {occupancy.length === 0 ? (
                <p className="py-3 text-sm text-muted">
                  No one is inside a course at the moment.
                </p>
              ) : (
                occupancy.map((o) => (
                  <HBar
                    key={o.courseId}
                    label={`${o.title} — ${o.count}`}
                    value={o.count}
                    max={maxOccupancy}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Growth                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-10">
        <p className="eyebrow eyebrow-gold">02 / Growth</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERIODS.map((p) => (
            <div key={p} className="panel rule-top p-5">
              <p className="display-lg text-foreground">{signups[p]}</p>
              <p className="eyebrow eyebrow-muted mt-2">
                Signups — {PERIOD_LABEL[p]}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERIODS.map((p) => (
            <div key={p} className="panel rule-top p-5">
              <p className="display-lg text-foreground">{actives[p]}</p>
              <p className="eyebrow eyebrow-muted mt-2">
                Active learners — {PERIOD_LABEL[p]}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="panel rule-top p-5">
            <p className="eyebrow eyebrow-muted">Signups — last 30 days</p>
            <div className="mt-4">
              <Sparkline
                points={signupSeries.map((s) => s.value)}
                label="Daily signups over the last 30 days"
                height={72}
              />
            </div>
          </div>
          <div className="panel rule-top p-5">
            <p className="eyebrow eyebrow-muted">
              Unit completions — last 30 days
            </p>
            <div className="mt-4">
              <Sparkline
                points={completionSeries.map((s) => s.value)}
                label="Daily unit completions over the last 30 days"
                height={72}
              />
            </div>
          </div>
        </div>

        <div className="panel rule-top mt-4 p-5">
          <p className="eyebrow eyebrow-muted">Signups by month — last 12</p>
          <div className="mt-4">
            <BarChart data={signupsByMonth} height={200} highlightLast />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Engagement                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-10">
        <p className="eyebrow eyebrow-gold">03 / Engagement</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="panel rule-top p-5">
            <p className="eyebrow eyebrow-muted">Enrollments by course</p>
            <div className="mt-4 grid gap-3">
              {engagement.length === 0 ? (
                <p className="py-3 text-sm text-muted">No courses yet.</p>
              ) : (
                engagement.map((c) => (
                  <div key={c.id}>
                    <HBar
                      label={`${c.title} — ${c.enrollments} enrolled`}
                      value={c.enrollments}
                      max={maxEnroll}
                    />
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {c.completions} unit completion
                      {c.completions === 1 ? "" : "s"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel rule-top flex flex-col items-center justify-center p-5">
            <p className="eyebrow eyebrow-muted">Test pass rate</p>
            <div className="mt-4">
              {passRate == null ? (
                <p className="py-8 text-sm text-muted">Nothing graded yet.</p>
              ) : (
                <Donut value={passRate} label="Pass rate" />
              )}
            </div>
            <Link
              href="/admin/grading"
              className="btn btn-ghost btn-sm mt-4"
            >
              Go to grading →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
