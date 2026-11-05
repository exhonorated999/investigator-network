import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeEngagement, formatDuration } from "./user-stats-calc";

const d = (s: string) => new Date(s + "T00:00:00Z");

test("site time = per-day max(site, course), never double counted", () => {
  const s = summarizeEngagement(
    [{ day: d("2026-11-03"), seconds: 600 }, { day: d("2026-11-04"), seconds: 100 }],
    [
      { day: d("2026-11-01"), seconds: 300, courseId: "a" }, // pre-site-tracking day
      { day: d("2026-11-03"), seconds: 400, courseId: "a" },
      { day: d("2026-11-04"), seconds: 200, courseId: "b" }, // course > site (clock edge)
    ],
    d("2026-11-05")
  );
  assert.equal(s.siteSeconds, 300 + 600 + 200);
  assert.equal(s.courseSeconds, 900);
  assert.equal(s.activeDays, 3);
  assert.equal(s.firstActiveDay, "2026-11-01");
  assert.equal(s.lastActiveDay, "2026-11-04");
  assert.equal(s.longestStreak, 2);
  assert.deepEqual(s.perCourse.map((p) => [p.courseId, p.seconds, p.days]), [["a", 700, 2], ["b", 200, 1]]);
  assert.equal(s.daily.length, 30);
  assert.equal(s.daily[29].day, "2026-11-05");
  assert.equal(s.daily[28].seconds, 200);
  assert.equal(s.activeDaysLast30, 3);
});

test("empty input", () => {
  const s = summarizeEngagement([], [], d("2026-11-05"));
  assert.equal(s.siteSeconds, 0);
  assert.equal(s.activeDays, 0);
  assert.equal(s.longestStreak, 0);
  assert.equal(s.firstActiveDay, null);
  assert.deepEqual(s.perCourse, []);
});

test("formatDuration", () => {
  assert.equal(formatDuration(0), "—");
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(37 * 60), "37m");
  assert.equal(formatDuration(2 * 3600 + 14 * 60), "2h 14m");
  assert.equal(formatDuration(3 * 3600), "3h");
});
