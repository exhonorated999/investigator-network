import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { PeriodKey } from "@/lib/analytics";
import { PERIOD_LABEL } from "@/lib/analytics";
import { courseTimeTotals, courseTopLearners, formatTime } from "@/lib/metrics";
import { loadLiveTrainingReminders } from "@/lib/reminders";
import { CopyEmails } from "../reminders/copy-emails";

export const dynamic = "force-dynamic";

const PERIODS: PeriodKey[] = ["week", "month", "quarter", "year"];

function isPeriod(v: string): v is PeriodKey {
  return (PERIODS as string[]).includes(v);
}

function relTime(d: Date | null): string {
  if (!d) return "never";
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return "now";
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; course?: string }>;
}) {
  const sp = await searchParams;
  const period: PeriodKey = sp.period && isPeriod(sp.period) ? sp.period : "month";

  const totals = await courseTimeTotals(period);
  // Default the drill-down to the busiest course, unless one is chosen.
  const selectedId = sp.course || totals[0]?.courseId || "";
  const [selectedCourse, topLearners] = await Promise.all([
    selectedId
      ? prisma.course.findUnique({ where: { id: selectedId }, select: { id: true, title: true } })
      : null,
    selectedId ? courseTopLearners(selectedId, period) : Promise.resolve([]),
  ]);

  // New-enrollee reminders (since the last live session) for the selected
  // course. Reuses the same source as the standalone Reminders page.
  const reminders = await loadLiveTrainingReminders();
  const reminder = reminders.find((r) => r.courseId === selectedId) ?? null;

  const fmtSession = (d: Date | null) =>
    d
      ? d.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";
  const fmtDay = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const href = (p: string, c: string) =>
    `/admin/metrics?period=${p}${c ? `&course=${c}` : ""}`;
  const grandTotal = totals.reduce((s, t) => s + t.seconds, 0);

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// ANALYTICS</p>
      <h1 className="display-lg mt-2 text-foreground">Course metrics</h1>
      <p className="mt-2 text-[15px] text-muted">
        Time on course, most engaged learners, and last activity — {PERIOD_LABEL[period].toLowerCase()}.
      </p>

      {/* Period tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={href(p, sp.course ?? "")}
            className={`shrink-0 border px-3 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
              p === period
                ? "border-accent-bright bg-[rgba(0,180,216,0.08)] text-accent-bright"
                : "border-border text-muted hover:border-border-strong hover:text-accent-bright"
            }`}
          >
            {p}
          </Link>
        ))}
        <span className="ml-auto self-center font-mono text-[11px] text-muted">
          {formatTime(grandTotal)} total across all courses
        </span>
      </div>

      {/* Per-course totals */}
      <div className="panel rule-top mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left">
            <tr>
              <th className="eyebrow eyebrow-muted px-4 py-3">Course</th>
              <th className="eyebrow eyebrow-muted px-4 py-3">Learners</th>
              <th className="eyebrow eyebrow-muted px-4 py-3">Time on course</th>
              <th className="eyebrow eyebrow-muted px-4 py-3 text-right">Drill down</th>
            </tr>
          </thead>
          <tbody>
            {totals.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  No recorded activity in this period yet.
                </td>
              </tr>
            ) : (
              totals.map((t) => (
                <tr
                  key={t.courseId}
                  className={`border-t border-border ${
                    t.courseId === selectedId ? "bg-[rgba(0,180,216,0.04)]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-foreground">{t.title}</td>
                  <td className="px-4 py-3 text-muted">{t.learners}</td>
                  <td className="px-4 py-3 font-mono text-accent-bright">
                    {formatTime(t.seconds)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={href(period, t.courseId)} className="btn btn-ghost btn-sm">
                      View learners →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Top learners for the selected course */}
      {selectedCourse ? (
        <div className="mt-8">
          <p className="eyebrow eyebrow-muted">Top learners</p>
          <h2 className="display-sm mt-1 text-foreground">{selectedCourse.title}</h2>
          <div className="panel rule-top mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr>
                  <th className="eyebrow eyebrow-muted px-4 py-3">Learner</th>
                  <th className="eyebrow eyebrow-muted px-4 py-3">Time</th>
                  <th className="eyebrow eyebrow-muted px-4 py-3">Units done</th>
                  <th className="eyebrow eyebrow-muted px-4 py-3 text-right">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {topLearners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted">
                      No learner activity for this course in this period.
                    </td>
                  </tr>
                ) : (
                  topLearners.map((l) => (
                    <tr key={l.userId} className="border-t border-border">
                      <td className="px-4 py-3">
                        <span className="text-foreground">{l.name}</span>
                        {l.agency ? (
                          <span className="ml-2 font-mono text-[11px] text-muted">{l.agency}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-accent-bright">
                        {formatTime(l.seconds)}
                      </td>
                      <td className="px-4 py-3 text-muted">{l.unitsCompleted}</td>
                      <td className="px-4 py-3 text-right font-mono text-[12px] text-muted">
                        {relTime(l.lastSeenAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* New enrollees since the last live session — for the selected course */}
      {reminder ? (
        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow eyebrow-gold">// LIVE-TRAINING REMINDERS</p>
              <h2 className="display-sm mt-1 text-foreground">
                New enrollees since last live session
              </h2>
              <p className="mt-1 font-mono text-[11px] text-muted">
                Last session: {fmtSession(reminder.lastSessionAt)} · Next:{" "}
                {fmtSession(reminder.nextSessionAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  reminder.enrollees.length > 0
                    ? "border-gold/40 bg-[rgba(244,162,97,0.08)] text-gold"
                    : "border-border text-muted"
                }`}
              >
                {reminder.enrollees.length} new
              </span>
              <CopyEmails emails={reminder.enrollees.map((e) => e.email)} />
              <Link href="/admin/reminders" className="btn btn-ghost btn-sm">
                All courses →
              </Link>
            </div>
          </div>

          <div className="panel rule-top mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr>
                  <th className="eyebrow eyebrow-muted px-4 py-3">Name</th>
                  <th className="eyebrow eyebrow-muted px-4 py-3">Email</th>
                  <th className="eyebrow eyebrow-muted px-4 py-3 text-right">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {reminder.enrollees.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted">
                      No new enrollees since the last live session.
                    </td>
                  </tr>
                ) : (
                  reminder.enrollees.map((e) => (
                    <tr key={e.userId} className="border-t border-border">
                      <td className="px-4 py-3 text-foreground">{e.name}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-muted">
                        {e.email}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-muted">
                        {fmtDay(e.enrolledAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
