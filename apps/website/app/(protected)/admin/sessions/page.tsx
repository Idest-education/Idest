"use client";

import { useEffect, useState } from "react";
import { getAllSessions, endSession, deleteSession } from "@/services/session.service";
import { SessionData, PaginatedResponse } from "@/types/session";
import { Eye, Trash2, Square } from "lucide-react";
import Link from "next/link";
import LoadingScreen from "@/components/loading-screen";

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<PaginatedResponse<SessionData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(8);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      // `getAllSessions` normalizes backend shapes into a stable contract:
      // { data: SessionData[]; pagination: PaginationMeta }
      const sessionsData = await getAllSessions({ page, limit });
      setSessions(sessionsData);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setSessions({
        data: [],
        pagination: {
          page: 1,
          limit: 8,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [page]);

  const handleEndSession = async (id: string) => {
    if (!confirm("Are you sure you want to end this session?")) return;
    try {
      await endSession(id);
      fetchSessions();
    } catch (error) {
      console.error("Error ending session:", error);
      alert("Failed to end session");
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) return;
    try {
      await deleteSession(id);
      fetchSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
      alert("Failed to delete session");
    }
  };

  if (loading && !sessions) return <LoadingScreen />;

  const sessionsList = Array.isArray(sessions?.data) ? sessions.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, color: "var(--color-text-primary)" }}>
          Sessions Management
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          View and manage all learning sessions
        </p>
      </div>

      {/* Table card */}
      <div
        className="overflow-hidden"
        style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", borderRadius: 12 }}
      >
        <div
          className="px-5 py-3"
          style={{ background: "var(--color-surface-muted)", borderBottom: "1.5px solid var(--color-border-default)" }}
        >
          <h3 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)" }}>
            Sessions ({sessions?.pagination?.total || 0})
          </h3>
        </div>

        <div className="p-4">
          {sessionsList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1.5px solid var(--color-border-default)", background: "var(--color-surface-muted)" }}>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Topic</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Class</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Host</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Start Time</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>End Time</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Status</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Recorded</th>
                    <th className="text-right p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsList.map((session) => {
                    const isActive = !session.end_time;
                    const startDate = new Date(session.start_time);
                    const endDate = session.end_time ? new Date(session.end_time) : null;

                    return (
                      <tr
                        key={session.id}
                        style={{ borderBottom: "1px solid var(--color-border-default)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface-subtle)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      >
                        <td className="p-3">
                          <div className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{session.metadata?.topic || "—"}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{session.class.name}</div>
                        </td>
                        <td className="p-3">
                          <div>
                            <div className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{session.host.full_name}</div>
                            <div className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{session.host.email}</div>
                          </div>
                        </td>
                        <td className="p-3 text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          {startDate.toLocaleString()}
                        </td>
                        <td className="p-3 text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          {endDate ? endDate.toLocaleString() : (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: "#dcfce7", color: "#166534", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                            >
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={
                              isActive
                                ? { background: "#dcfce7", color: "#166534", fontFamily: "Plus Jakarta Sans, sans-serif" }
                                : { background: "var(--color-surface-subtle)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }
                            }
                          >
                            {isActive ? "Active" : "Ended"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={
                              session.is_recorded
                                ? { background: "#dcfce7", color: "#166534", fontFamily: "Plus Jakarta Sans, sans-serif" }
                                : { background: "var(--color-surface-subtle)", border: "1px solid var(--color-border-default)", color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }
                            }
                          >
                            {session.is_recorded ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/admin/sessions/${session.id}`}>
                              <button className="p-1.5 rounded-lg" style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}>
                                <Eye className="w-4 h-4" />
                              </button>
                            </Link>
                            {isActive && (
                              <button
                                onClick={() => handleEndSession(session.id)}
                                className="p-1.5 rounded-lg"
                                style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}
                              >
                                <Square className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="p-1.5 rounded-lg"
                              style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "var(--color-error)" }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>No sessions found</div>
          )}

          {sessions && sessions.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              >
                Previous
              </button>
              <span className="text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                Page {page} of {sessions.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(sessions.pagination.totalPages, p + 1))}
                disabled={page >= sessions.pagination.totalPages}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
