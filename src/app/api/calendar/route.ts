import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Serves a calendar invite as a real .ics file over HTTP.
 *
 * A client-side Blob download works on desktop but is unreliable on iOS/Android,
 * where the OS wants a genuine text/calendar response to hand off to Outlook or
 * Apple Calendar. Teams has no "add to calendar" deep link of its own — a Teams
 * user's calendar *is* their Outlook calendar, so an .ics (or the Outlook web
 * link) is the correct handoff for both.
 *
 * Query: title, start (ISO), end (ISO), url, location, details, allday=1
 */
export async function GET(request: Request) {
  // Signed-in only. Nothing sensitive is served (the caller supplies the
  // contents), but there's no reason to leave a file generator open.
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const q = new URL(request.url).searchParams;
  const title = (q.get("title") || "Live session").slice(0, 300);
  const start = new Date(q.get("start") || "");
  if (Number.isNaN(start.getTime())) {
    return new NextResponse("Bad start", { status: 400 });
  }

  const rawEnd = q.get("end");
  const end = rawEnd ? new Date(rawEnd) : null;
  const allDay = q.get("allday") === "1";
  const location = (q.get("location") || "").slice(0, 300);
  const url = (q.get("url") || "").slice(0, 2000);
  const details = (q.get("details") || "").slice(0, 2000);

  const fallbackEnd = new Date(start.getTime() + 60 * 60_000);
  const endAt = end && !Number.isNaN(end.getTime()) ? end : fallbackEnd;

  // RFC 5545 text escaping: backslash first, then delimiters, then newlines.
  const esc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/[,;]/g, (m) => "\\" + m)
      .replace(/\r?\n/g, "\\n");

  const utc = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateOnly = (d: Date) => utc(d).slice(0, 8);

  // Long lines must be folded at 75 octets or strict parsers choke.
  const fold = (line: string) => {
    if (line.length <= 73) return line;
    const out: string[] = [line.slice(0, 73)];
    let rest = line.slice(73);
    while (rest.length > 72) {
      out.push(" " + rest.slice(0, 72));
      rest = rest.slice(72);
    }
    if (rest) out.push(" " + rest);
    return out.join("\r\n");
  };

  const uid = `${start.getTime()}-${Buffer.from(title).toString("hex").slice(0, 16)}@investigator-network`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Investigator Network//Training//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utc(new Date())}`,
    allDay
      ? `DTSTART;VALUE=DATE:${dateOnly(start)}`
      : `DTSTART:${utc(start)}`,
    allDay ? `DTEND;VALUE=DATE:${dateOnly(endAt)}` : `DTEND:${utc(endAt)}`,
    `SUMMARY:${esc(title)}`,
    details ? `DESCRIPTION:${esc(details)}` : "",
    location ? `LOCATION:${esc(location)}` : "",
    url ? `URL:${esc(url)}` : "",
    "STATUS:CONFIRMED",
    // 30-minute nudge, matching when the in-app Join button unlocks.
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .map(fold)
    .join("\r\n");

  const filename =
    (title.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) ||
      "training") + ".ics";

  return new NextResponse(lines + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
