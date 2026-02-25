"use client";

import { useEffect, useState } from "react";
import { getAllSessions, endSession, deleteSession } from "@/services/session.service";
import { SessionData, PaginatedResponse } from "@/types/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
          hasPrev: false 
        } 
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
        <h1 className="text-3xl font-bold text-gray-900">Sessions Management</h1>
        <p className="text-gray-600 mt-2">View and manage all learning sessions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Sessions ({sessions?.pagination?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Topic</th>
                    <th className="text-left p-3">Class</th>
                    <th className="text-left p-3">Host</th>
                    <th className="text-left p-3">Start Time</th>
                    <th className="text-left p-3">End Time</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Recorded</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsList.map((session) => {
                    const isActive = !session.end_time;
                    const startDate = new Date(session.start_time);
                    const endDate = session.end_time ? new Date(session.end_time) : null;

                    return (
                      <tr key={session.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium">{session.metadata?.topic || "—"}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{session.class.name}</div>
                        </td>
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{session.host.full_name}</div>
                            <div className="text-sm text-gray-500">{session.host.email}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          {startDate.toLocaleString()}
                        </td>
                        <td className="p-3">
                          {endDate ? endDate.toLocaleString() : <Badge variant="outline">Active</Badge>}
                        </td>
                        <td className="p-3">
                          <Badge variant={isActive ? "default" : "secondary"}>
                            {isActive ? "Active" : "Ended"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={session.is_recorded ? "default" : "outline"}>
                            {session.is_recorded ? "Yes" : "No"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/admin/sessions/${session.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            {isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEndSession(session.id)}
                              >
                                <Square className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSession(session.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No sessions found</div>
          )}

          {sessions && sessions.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {sessions.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(sessions.pagination.totalPages, p + 1))}
                disabled={page >= sessions.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

