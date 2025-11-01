"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getUserSessions,
  endSession,
  deleteSession,
} from "@/services/session.service";
import { SessionData, UserSessionsResponse } from "@/types/session";
import SessionCard from "@/components/session/session-card";
import UpdateSessionModal from "@/components/session/update-session-modal";
import LoadingScreen from "@/components/loading-screen";
import { Calendar } from "lucide-react";

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(
    null
  );
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        setCurrentUserId(data.user?.id || "");
      } catch (err) {
        console.error("Error fetching session:", err);
      }
    };
    fetchSession();
  }, []);

  const loadSessions = async () => {
    try {
      const res: any = await getUserSessions();
      console.log("Sessions API response:", res);
      
      let allSessions: SessionData[] = [];
      
      // Handle different response structures
      // API returns: { status, message, data, statusCode }
      // Service returns res.data from axios, so we get the API response object
      if (res?.data) {
        // Check if data is structured as { hosted, attended, upcoming }
        if (res.data.hosted || res.data.attended || res.data.upcoming) {
          // UserSessionsResponse format
          allSessions = [
            ...(res.data.hosted || []),
            ...(res.data.attended || []),
            ...(res.data.upcoming || []),
          ];
        } else if (Array.isArray(res.data)) {
          // Direct array format (API returned { data: [...] })
          allSessions = res.data;
        }
      } else if (Array.isArray(res)) {
        // Response is directly an array (fallback)
        allSessions = res;
      }
      
      // Remove duplicates by session ID
      const uniqueSessions = Array.from(
        new Map(allSessions.map((s) => [s.id, s])).values()
      );
      
      console.log("Processed sessions:", uniqueSessions);
      setSessions(uniqueSessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleEdit = (session: SessionData) => {
    setSelectedSession(session);
    setShowUpdateModal(true);
  };

  const handleEnd = async (sessionId: string) => {
    try {
      const res = await endSession(sessionId);
      if (res.statusCode === 200) {
        loadSessions();
      } else {
        alert(res.message || "Failed to end session");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      const res = await deleteSession(sessionId);
      if (res.statusCode === 200) {
        loadSessions();
      } else {
        alert(res.message || "Failed to delete session");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  const groupSessionsByDate = (sessions: SessionData[]) => {
    const now = new Date();
    // Use local date for grouping
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups = {
      today: [] as SessionData[],
      tomorrow: [] as SessionData[],
      upcoming: [] as SessionData[],
      past: [] as SessionData[],
    };

    sessions.forEach((session) => {
      // Parse session start_time (UTC) and convert to local date
      const sessionDate = new Date(session.start_time);
      const sessionDay = new Date(
        sessionDate.getFullYear(),
        sessionDate.getMonth(),
        sessionDate.getDate()
      );

      // Check if session has ended
      const hasEnded = session.end_time && new Date(session.end_time) < now;

      if (hasEnded) {
        // Skip past sessions for now, or add to past group if needed
        return;
      }

      if (sessionDay.getTime() === today.getTime()) {
        groups.today.push(session);
      } else if (sessionDay.getTime() === tomorrow.getTime()) {
        groups.tomorrow.push(session);
      } else if (sessionDay > today) {
        groups.upcoming.push(session);
      }
    });

    return groups;
  };

  if (loading) return <LoadingScreen />;

  const groupedSessions = groupSessionsByDate(sessions);
  const hasSessions = sessions.length > 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="border-b border-gray-200 pb-6 mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Sessions</h1>
        <p className="text-gray-600">
          Your upcoming learning sessions and schedules
        </p>
      </div>

      {!hasSessions ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No upcoming sessions
            </h3>
            <p className="text-gray-600 mb-6">
              You don&apos;t have any scheduled sessions yet. Sessions will
              appear here once they are created by your teachers.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedSessions.today.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Today
              </h2>
              <div className="space-y-3">
                {groupedSessions.today.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onEdit={handleEdit}
                    onEnd={handleEnd}
                    onDelete={handleDelete}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}

          {groupedSessions.tomorrow.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Tomorrow
              </h2>
              <div className="space-y-3">
                {groupedSessions.tomorrow.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onEdit={handleEdit}
                    onEnd={handleEnd}
                    onDelete={handleDelete}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}

          {groupedSessions.upcoming.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upcoming
              </h2>
              <div className="space-y-3">
                {groupedSessions.upcoming.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onEdit={handleEdit}
                    onEnd={handleEnd}
                    onDelete={handleDelete}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <UpdateSessionModal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onUpdated={loadSessions}
        session={selectedSession}
      />
    </div>
  );
}
