"use client";

import { useCallback, useEffect, useState } from "react";
import { getClasses, searchClasses } from "@/services/class.service";
import { getClassCalendarEvents } from "@/services/calendar.service";
import ClassesSection from "@/components/class/class-section";
import { ClassResponse, ClassData } from "@/types/class";
import { ClassCalendarEventsResponse } from "@/types/calendar";
import { Users, Search, X } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";
import { PlusCircle } from "lucide-react";
import AddClassModal from "@/components/class/add-class-modal";
import JoinClassModal from "@/components/class/join-class-modal";
import ClassScheduleCalendar from "@/components/calendar/ClassScheduleCalendar";
import { toast } from "sonner";

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassResponse>({
    created: [],
    teaching: [],
    enrolled: [],
  });
  const [loading, setLoading] = useState(true);

  // --- Thêm các state cho tìm kiếm ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClassData[]>([]);
  const [searching, setSearching] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [calendarData, setCalendarData] = useState<ClassCalendarEventsResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        setUserRole(data.user?.user_metadata?.role || null);
      } catch (err) {
        console.error("Error fetching session:", err);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    getClasses()
      .then((data) => {
        setClasses(data?.data || { created: [], teaching: [], enrolled: [] });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const loadCalendarData = useCallback(async () => {
    try {
      setCalendarLoading(true);
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59).toISOString();
      const data = await getClassCalendarEvents({ from, to });
      setCalendarData(data);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      setCalendarData({ from: "", to: "", total: 0, events: [] });
      toast.error("Không thể tải lịch học. Vui lòng thử lại.");
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  // --- Debounce search ---
  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        setSearching(true);
        searchClasses(searchQuery)
          .then((data) => setSearchResults(data?.data || []))
          .catch((err) => console.error(err))
          .finally(() => setSearching(false));
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  if (loading) return <LoadingScreen />;

  const hasClasses =
    classes.created.length > 0 ||
    classes.teaching.length > 0 ||
    classes.enrolled.length > 0;
  const calendarEvents = calendarData?.events ?? [];
  const nextClassEvent = [...calendarEvents]
    .filter((event) => new Date(event.start).getTime() >= Date.now())
    .sort(
      (a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime(),
    )[0];

  const handleSaveCalendar = async () => {
    try {
      setSavingCalendar(true);
      const response = await fetch("/api/calendar/classes", {
        method: "GET",
      });
      if (!response.ok) throw new Error("Failed to download calendar");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "classes-calendar.ics";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Đã tải file lịch để lưu vào Calendar.");
    } catch (error) {
      console.error("Error saving calendar:", error);
      toast.error("Không thể tải file lịch.");
    } finally {
      setSavingCalendar(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-app)" }}>
      <div className="px-6 py-10">
        {/* Header */}
        <div className="mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Eyebrow pill */}
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest"
                style={{
                  background: "var(--color-surface-subtle)",
                  border: "1px solid var(--color-border-default)",
                  color: "var(--color-text-secondary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                Học tập cùng nhau, phát triển cùng nhau
              </div>

              {/* H1 — Oswald, no gradient */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    fontWeight: 700,
                    fontSize: 40,
                    color: "var(--color-text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Lớp học
                </h1>
                <div className="flex items-center gap-2">
                  {(userRole === "TEACHER" || userRole === "ADMIN") && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                      style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      <PlusCircle className="w-4 h-4" />
                      Tạo lớp học
                    </button>
                  )}
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1.5px solid var(--color-border-default)",
                      color: "var(--color-text-primary)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }}
                  >
                    <Users className="w-4 h-4" />
                    Tham gia lớp học
                  </button>
                </div>
              </div>

              <p
                className="max-w-[52ch]"
                style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 14 }}
              >
                Quản lý lớp học và hành trình học tập của bạn. Tạo, tham gia và khám phá các lớp học mới.
              </p>

              {/* Stat strip — 3 varied cells */}
              <div className="grid grid-cols-3 gap-3">
                {/* Cell 1 — accent */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--color-surface-subtle)",
                    border: "1.5px solid var(--color-brand)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "var(--color-brand)",
                      lineHeight: 1,
                    }}
                  >
                    {classes.created.length}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Đã tạo</p>
                </div>
                {/* Cell 2 — standard */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 24,
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {classes.teaching.length}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Giảng dạy</p>
                </div>
                {/* Cell 3 — compact */}
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 20,
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {classes.enrolled.length}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Ghi danh</p>
                </div>
              </div>

              {/* Next class callout */}
              {nextClassEvent && (
                <div
                  className="flex items-center gap-3 py-3 px-4"
                  style={{
                    background: "var(--color-surface-subtle)",
                    borderLeft: "3px solid var(--color-brand)",
                    borderRadius: "0 8px 8px 0",
                  }}
                >
                  <span
                    className="flex-shrink-0 rounded-full"
                    style={{ width: 8, height: 8, background: "var(--color-brand)" }}
                  />
                  <div className="min-w-0">
                    <p
                      className="font-semibold truncate text-sm"
                      style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      {nextClassEvent.className}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      {new Date(nextClassEvent.start).toLocaleString("vi-VN", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column — Calendar unchanged */}
            <div className="min-w-0">
              <ClassScheduleCalendar
                events={calendarEvents}
                onSaveCalendar={() => void handleSaveCalendar()}
                savingCalendar={savingCalendar}
              />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 animate-in fade-in slide-in-from-top-4">
          <div className="relative max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm lớp học theo tên hoặc mô tả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg pl-10 pr-10 py-2.5 text-sm outline-none"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-brand)";
                e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {searching ? "Đang tìm kiếm..." : searchResults.length > 0 ? `Tìm thấy ${searchResults.length} lớp học` : "Không tìm thấy lớp học nào"}
            </p>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            {searching ? (
              <div className="py-24 flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--color-border-default)", borderTopColor: "transparent" }}
                  />
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Đang tìm kiếm...</p>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              <ClassesSection title="" classes={searchResults} />
            ) : (
              <div
                className="rounded-2xl p-12 text-center"
                style={{
                  border: "1.5px dashed var(--color-border-default)",
                  background: "var(--color-surface-subtle)",
                }}
              >
                <div className="max-w-md mx-auto space-y-4">
                  <Search className="w-10 h-10 mx-auto" style={{ color: "var(--color-text-muted)" }} />
                  <h3
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: 22,
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    Không tìm thấy lớp học
                  </h3>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Không tìm thấy lớp học nào cho &quot;{searchQuery}&quot;
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1.5px solid var(--color-border-default)",
                      color: "var(--color-text-primary)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }}
                  >
                    Xóa tìm kiếm
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Classes Sections */}
        {!searchQuery.trim() && (
          hasClasses ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              {classes.created.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontWeight: 600,
                        fontSize: 20,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      Đã tạo bởi bạn
                    </h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: "var(--color-surface-subtle)",
                        color: "var(--color-text-secondary)",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}
                    >
                      {classes.created.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.created} />
                </div>
              )}

              {classes.teaching.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontWeight: 600,
                        fontSize: 20,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      Đang giảng dạy
                    </h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: "var(--color-surface-subtle)",
                        color: "var(--color-text-secondary)",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}
                    >
                      {classes.teaching.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.teaching} />
                </div>
              )}

              {classes.enrolled.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontWeight: 600,
                        fontSize: 20,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      Đã ghi danh
                    </h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: "var(--color-surface-subtle)",
                        color: "var(--color-text-secondary)",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}
                    >
                      {classes.enrolled.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.enrolled} />
                </div>
              )}
            </div>
          ) : (
            <div
              className="rounded-2xl p-12 text-center animate-in fade-in slide-in-from-bottom-4"
              style={{
                border: "1.5px dashed var(--color-border-default)",
                background: "var(--color-surface-subtle)",
              }}
            >
              <div className="max-w-md mx-auto space-y-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: "var(--color-surface-muted)" }}
                >
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--color-brand)" }}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                </div>
                <h3
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Chưa có lớp học nào
                </h3>
                <p className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  Bắt đầu bằng cách tạo hoặc tham gia một lớp học để bắt đầu hành trình học tập của bạn.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                  {(userRole === "TEACHER" || userRole === "ADMIN") && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      <PlusCircle className="w-4 h-4" />
                      Tạo lớp học
                    </button>
                  )}
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1.5px solid var(--color-border-default)",
                      color: "var(--color-text-primary)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }}
                  >
                    <Users className="w-4 h-4" />
                    Tham gia lớp học
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        <AddClassModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            getClasses().then((data) =>
              setClasses(data?.data || { created: [], teaching: [], enrolled: [] })
            );
          }}
        />
        <JoinClassModal
          open={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          enrolledClasses={classes.enrolled}
          onJoined={() => {
            getClasses().then((data) =>
              setClasses(data?.data || { created: [], teaching: [], enrolled: [] })
            );
          }}
        />
      </div>
    </div>
  );
}
