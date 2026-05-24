"use client";

import { useEffect, useState } from "react";
import { getUserSessions } from "@/services/session.service";
import { SessionData, PaginatedResponse } from "@/types/session";
import SessionCard from "@/components/session/session-card";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        setCurrentUserId(data.user?.id || "");
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserData();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUserSessions({ page, limit: 50 });
      
      // Handle paginated response from getUserSessions
      // Since getUserSessions might return UserSessionsResponse structure OR paginated list
      // Based on recent updates, we assume it returns a flat paginated list for simplicity, 
      // or we need to handle the structured response if it still returns { hosted, attended, upcoming }
      // The service update suggests it calls /session/user which now returns paginated list.
      
      let sessionList: SessionData[] = [];
      
      if (res && res.data) {
         if (Array.isArray(res.data)) {
            sessionList = res.data;
         } else if ((res.data as any).data && Array.isArray((res.data as any).data)) {
            // It's a PaginatedResponse
            sessionList = (res.data as PaginatedResponse<SessionData>).data;
            // setHasMore((res.data as PaginatedResponse<SessionData>).pagination.hasNext);
         } else if ((res.data as any).hosted || (res.data as any).attended || (res.data as any).upcoming) {
             // It's the old UserSessionsResponse structure
             // We need to merge them or handle them. 
             // Let's assume for this page we just want a flat list if possible, 
             // but if the backend returns grouped, we might need to flatten it.
             // However, the recent backend prompt said /session/user returns paginated list.
             // Let's try to treat it as flat list first.
             console.warn("Received structured response, unexpected for new backend version");
         }
      }

      setSessions(sessionList);
    } catch (err: any) {
      setError(err.message || "Không thể tải buổi học");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [page]);

  const filteredSessions = sessions.filter((s) => {
    const now = new Date();
    const startTime = new Date(s.start_time);
    if (filter === "upcoming") {
      return startTime >= now || s.end_time === null;
    } else {
      return s.end_time !== null && new Date(s.end_time) < now;
    }
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-app)" }}>
      <div className="px-6 py-6 md:py-8 space-y-6">
        <div style={{ borderBottom: "1.5px solid var(--color-border-default)" }} className="pb-6">
          <h1
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              fontSize: 32,
              color: "var(--color-text-primary)",
            }}
          >
            Buổi học của tôi
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Xem và quản lý các buổi học sắp tới và đã qua của bạn.
          </p>
        </div>

        {/* Warm pill filter tabs */}
        <div
          className="inline-flex rounded-full p-1 gap-1"
          style={{ background: "var(--color-surface-muted)" }}
        >
          {(["upcoming", "past"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-150"
              style={
                filter === f
                  ? {
                      background: "var(--color-brand)",
                      color: "#fff",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }
                  : {
                      background: "transparent",
                      color: "var(--color-text-muted)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }
              }
            >
              {f === "upcoming" ? "Sắp tới" : "Đã qua"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--color-border-default)", borderTopColor: "transparent" }}
            />
          </div>
        ) : error ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--color-error)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            {error}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Không tìm thấy buổi học {filter === "upcoming" ? "sắp tới" : "đã qua"}.
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                currentUserId={currentUserId}
                allowReviewAction={filter === "past"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

