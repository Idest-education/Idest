"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClassCalendarEvent } from "@/types/calendar";

interface ClassScheduleCalendarProps {
  events: ClassCalendarEvent[];
  onSaveCalendar?: () => void;
  savingCalendar?: boolean;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EVENT_COLOR_CLASSES = [
  "bg-orange-100 text-orange-800",
  "bg-amber-100 text-amber-800",
  "bg-yellow-100 text-yellow-800",
  "bg-lime-100 text-lime-800",
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-indigo-100 text-indigo-800",
  "bg-violet-100 text-violet-800",
  "bg-pink-100 text-pink-800",
];

function toMondayIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

export default function ClassScheduleCalendar({
  events,
  onSaveCalendar,
  savingCalendar = false,
}: ClassScheduleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const eventMap = useMemo(() => {
    const map = new Map<string, ClassCalendarEvent[]>();
    for (const event of events) {
      const date = new Date(event.start);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const classColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let colorIndex = 0;
    for (const event of events) {
      if (!map.has(event.classId)) {
        map.set(
          event.classId,
          EVENT_COLOR_CLASSES[colorIndex % EVENT_COLOR_CLASSES.length],
        );
        colorIndex += 1;
      }
    }
    return map;
  }, [events]);

  const monthGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = toMondayIndex(firstDay.getDay());
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - startOffset);

    return Array.from({ length: 42 }).map((_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date;
    });
  }, [currentMonth]);

  const title = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const now = new Date();

  return (
    <div className="w-full min-w-0 rounded-lg border border-orange-100 bg-gradient-to-br from-white via-orange-50/40 to-orange-100/40 p-2.5 lg:p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">Lịch học</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onSaveCalendar}
            disabled={savingCalendar}
            aria-label="Lưu lịch vào Calendar"
            title={savingCalendar ? "Đang lưu..." : "Lưu lịch"}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <h4 className="text-base font-bold text-gray-900">{title}</h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setCurrentMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => {
              const today = new Date();
              setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setCurrentMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-7 gap-1 text-[10px] text-gray-600">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="px-1 py-0.5 text-center font-semibold">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthGrid.map((date) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isToday =
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const dayEvents = eventMap.get(key) ?? [];

          return (
            <div
              key={key}
              className={[
                "min-h-16 rounded border p-1 overflow-hidden",
                isCurrentMonth
                  ? "bg-gradient-to-br from-white to-orange-50/40 border-orange-200"
                  : "bg-orange-50/60 border-orange-100",
              ].join(" ")}
            >
              <div
                className={[
                  "text-[10px] font-semibold",
                  isToday ? "text-orange-600" : isCurrentMonth ? "text-gray-700" : "text-gray-400",
                ].join(" ")}
              >
                {date.getDate()}
              </div>

              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className={[
                      "truncate rounded px-1 py-0.5 text-[9px] font-semibold",
                      classColorMap.get(event.classId) ?? "bg-orange-100 text-orange-800",
                    ].join(" ")}
                    title={`${event.className} - ${new Date(event.start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`}
                  >
                    {new Date(event.start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {event.className}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-gray-500">+{dayEvents.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
