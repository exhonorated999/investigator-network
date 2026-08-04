import { loadLiveTrainingReminders } from "@/lib/reminders";
import { CopyEmails } from "./copy-emails";

export const dynamic = "force-dynamic";

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function RemindersPage() {
  const courses = await loadLiveTrainingReminders();
  const totalToNotify = courses.reduce((s, c) => s + c.enrollees.length, 0);

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// COMMS</p>
      <h1 className="display-lg mt-2 text-foreground">Live-training reminders</h1>
      <p className="mt-2 text-[15px] text-muted">
        New enrollees since each course&apos;s last live session — copy their emails to send a
        reminder about the next one.
      </p>

      {courses.length === 0 ? (
        <p className="panel rule-top mt-6 px-6 py-8 text-muted">
          No courses have live sessions yet. Add a live-session unit to a course to track
          new enrollees here.
        </p>
      ) : (
        <>
          <p className="mt-4 font-mono text-[12px] text-muted">
            {totalToNotify} learner{totalToNotify === 1 ? "" : "s"} to notify across{" "}
            {courses.length} course{courses.length === 1 ? "" : "s"}.
          </p>

          <div className="mt-6 space-y-4">
            {courses.map((c) => (
              <div key={c.courseId} className="panel rule-top p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="display-sm text-foreground">{c.title}</h2>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      Last session: {fmt(c.lastSessionAt)} · Next: {fmt(c.nextSessionAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                        c.enrollees.length > 0
                          ? "border-gold/40 text-gold bg-[rgba(244,162,97,0.08)]"
                          : "border-border text-muted"
                      }`}
                    >
                      {c.enrollees.length} new
                    </span>
                    <CopyEmails emails={c.enrollees.map((e) => e.email)} />
                  </div>
                </div>

                {c.enrollees.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">
                    No new enrollees since the last live session.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-left">
                        <tr>
                          <th className="eyebrow eyebrow-muted px-3 py-2">Name</th>
                          <th className="eyebrow eyebrow-muted px-3 py-2">Email</th>
                          <th className="eyebrow eyebrow-muted px-3 py-2 text-right">Enrolled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.enrollees.map((e) => (
                          <tr key={e.userId} className="border-t border-border">
                            <td className="px-3 py-2 text-foreground">{e.name}</td>
                            <td className="px-3 py-2 font-mono text-[12px] text-muted">{e.email}</td>
                            <td className="px-3 py-2 text-right font-mono text-[11px] text-muted">
                              {fmtDay(e.enrolledAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
