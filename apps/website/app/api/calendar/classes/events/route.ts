import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ClassCalendarEventsResponse } from "@/types/calendar";

type BackendEnvelope<T> = {
  data?: T;
};

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
    console.error("Calendar events upstream fetch failed:", error);
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
  return NextResponse.json(payload?.data ?? payload);
}
