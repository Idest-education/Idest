"use client";

import { useEffect, useState } from "react";
import { getUserSessions } from "@/services/session.service";
import { SessionData, PaginatedResponse } from "@/types/session";
import { Loader2 } from "lucide-react";
import SessionCard from "@/components/session/session-card";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        <div className="border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Buổi học của tôi</h1>
          <p className="text-gray-600">Xem và quản lý các buổi học sắp tới và đã qua của bạn.</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === "upcoming" ? "default" : "outline"}
            onClick={() => setFilter("upcoming")}
          >
            Sắp tới
          </Button>
          <Button
            variant={filter === "past" ? "default" : "outline"}
            onClick={() => setFilter("past")}
          >
            Đã qua
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            {error}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Không tìm thấy buổi học {filter === "upcoming" ? "sắp tới" : "đã qua"}.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                currentUserId={currentUserId}
                // Add handlers if needed
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

