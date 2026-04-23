export type CalendarEventSource = "recurring" | "session";

export interface ClassCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  source: CalendarEventSource;
  classId: string;
  className: string;
  timezone?: string | null;
}

export interface ClassCalendarEventsResponse {
  from: string;
  to: string;
  total: number;
  events: ClassCalendarEvent[];
}
