import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ClassCalendarEvent, ClassCalendarEventsResponse } from "@/types/calendar";

type BackendEnvelope<T> = {
  data?: T;
};

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsDate(dateInput: string): string {
  const date = new Date(dateInput);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

function buildIcs(events: ClassCalendarEvent[]): string {
  const dtStamp = toIcsDate(new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Idest//Classes Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(event.id)}@idest`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${toIcsDate(event.start)}`);
    lines.push(`DTEND:${toIcsDate(event.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    lines.push(
      `DESCRIPTION:${escapeIcsText(
        `${event.className} (${event.source === "session" ? "Session" : "Recurring"})`,
      )}`,
    );
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://ie-backend.fly.dev";

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);

  const backendUrl = `${apiUrl}/class/calendar/events${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  let response: Response;
  try {
    response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Calendar ICS upstream fetch failed:", error);
    return NextResponse.json(
      { message: "Calendar service is unavailable" },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { message: "Failed to fetch calendar events", details: text },
      { status: response.status },
    );
  }

  const payload: BackendEnvelope<ClassCalendarEventsResponse> = await response.json();
  const data = payload?.data ?? (payload as unknown as ClassCalendarEventsResponse);
  const ics = buildIcs(data.events ?? []);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="classes-calendar.ics"',
      "Cache-Control": "no-store",
    },
  });
}
