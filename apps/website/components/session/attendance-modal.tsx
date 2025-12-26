"use client";

import { useEffect, useState, useCallback } from "react";
import { getSessionAttendance } from "@/services/session.service";
import { SessionAttendanceSummaryDto, AttendanceRecordDto } from "@/types/session";
import { X, Users, CheckCircle2, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingScreen from "@/components/loading-screen";

interface AttendanceModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName?: string;
}

export default function AttendanceModal({
  open,
  onClose,
  sessionId,
  sessionName,
}: AttendanceModalProps) {
  const [attendance, setAttendance] = useState<SessionAttendanceSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionAttendance(sessionId);
      setAttendance(data as SessionAttendanceSummaryDto);
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setError("Không thể tải dữ liệu điểm danh");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (open && sessionId) {
      fetchAttendance();
    } else {
      setAttendance(null);
      setError(null);
    }
  }, [open, sessionId, fetchAttendance]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col z-10 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Điểm danh</h2>
            {sessionName && (
              <p className="text-sm text-gray-600 mt-1">{sessionName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingScreen />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchAttendance} variant="outline">
                Thử lại
              </Button>
            </div>
          ) : attendance ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Tổng tham gia</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{attendance.total_attendees}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Đã điểm danh</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">{attendance.attended_count}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">Đang tham gia</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">{attendance.active_attendees}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900">Thời gian TB</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-900">
                    {formatDuration(attendance.average_duration_seconds)}
                  </p>
                </div>
              </div>

              {/* Attendees List */}
              {attendance.attendees && attendance.attendees.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Danh sách tham gia ({attendance.attendees.length})
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Tên
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Tham gia lúc
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Rời lúc
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Thời gian
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Trạng thái
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {attendance.attendees.map((attendee: AttendanceRecordDto) => (
                            <tr key={attendee.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">
                                  {attendee.user?.full_name || "Không xác định"}
                                </div>
                                {attendee.user?.email && (
                                  <div className="text-sm text-gray-500">{attendee.user.email}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {attendee.joined_at ? formatDateTime(attendee.joined_at) : "N/A"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {attendee.left_at ? formatDateTime(attendee.left_at) : "Chưa rời"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {formatDuration(attendee.duration_seconds)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={attendee.is_attended ? "default" : "outline"}
                                  className={
                                    attendee.is_attended
                                      ? "bg-green-100 text-green-800 border-green-200"
                                      : "bg-gray-100 text-gray-800 border-gray-200"
                                  }
                                >
                                  {attendee.is_attended ? "Đã điểm danh" : "Chưa điểm danh"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Chưa có người tham gia</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Không có dữ liệu điểm danh</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <Button onClick={onClose} variant="outline">
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

