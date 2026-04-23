import { ClassCalendarEventsResponse } from "@/types/calendar";

export async function getClassCalendarEvents(params?: {
  from?: string;
  to?: string;
}): Promise<ClassCalendarEventsResponse> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);

  const query = search.toString();
  const response = await fetch(
    `/api/calendar/classes/events${query ? `?${query}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch calendar events");
  }

  return response.json();
}
