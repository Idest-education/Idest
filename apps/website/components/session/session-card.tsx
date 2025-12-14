"use client";

import { SessionData } from "@/types/session";
import { Clock, Users, User, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface SessionCardProps {
  session: SessionData;
  onEdit?: (session: SessionData) => void;
  onEnd?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  currentUserId?: string;
  showActions?: boolean;
}

export default function SessionCard({
  session,
  onEdit,
  onEnd,
  onDelete,
  currentUserId,
  showActions = true,
}: SessionCardProps) {
  const router = useRouter();
  
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };
  
  // Get user's timezone for display
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const isHost = currentUserId === session.host_id;
  const isActive = session.end_time === null;

  const handleJoinMeeting = () => {
    router.push(`/sessions/${session.id}/meet`);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-900 transition-colors">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-gray-900">
              {session.metadata?.topic || "Buổi học chưa có tên"}
            </h3>
            {isActive && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-md ml-2">
                Đang diễn ra
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-3">{session.class.name}</p>

          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5" />
              <div>
                <p>
                  {formatDateTime(session.start_time)}
                  {session.end_time && ` → ${formatTime(session.end_time)}`}
                </p>
                <p className="text-xs text-gray-500">
                  ({userTimezone})
                </p>
              </div>
            </div>
            <p className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Người chủ trì:{" "}
              <span className="font-medium text-gray-900">
                {session.host.full_name}
              </span>
            </p>
            {(session.attendance_summary?.total_attendees !== undefined || session.metadata?.attendees_count !== undefined) && (
              <p className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Người tham gia:{" "}
                <span className="font-medium text-gray-900">
                  {session.attendance_summary?.total_attendees ?? session.metadata?.attendees_count}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* Join Meeting button - shown for all users when session is active */}
          {isActive && (
            <Button
              onClick={handleJoinMeeting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
              size="default"
            >
              <Video className="w-5 h-5 mr-2" />
              Tham gia buổi học
            </Button>
          )}

          {/* Host actions */}
          {showActions && isHost && (
            <div className="flex flex-row md:flex-col gap-2">
              {onEdit && (
                <Button
                  onClick={() => onEdit(session)}
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  Chỉnh sửa
                </Button>
              )}
              {isActive && onEnd && (
                <Button
                  onClick={() => onEnd(session.id)}
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  Kết thúc
                </Button>
              )}
              {onDelete && (
                <Button
                  onClick={() => onDelete(session.id)}
                  variant="outline"
                  size="sm"
                  className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Xóa
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

