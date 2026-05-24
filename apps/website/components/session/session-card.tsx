"use client";

import { SessionData } from "@/types/session";
import { Clock, User, Users, Video, Download } from "lucide-react";
import { useRouter } from "next/navigation";

interface SessionCardProps {
  session: SessionData;
  onEdit?: (session: SessionData) => void;
  onEnd?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  currentUserId?: string;
  showActions?: boolean;
  canExportAttendance?: boolean;
  onExportAttendance?: (session: SessionData) => void;
  isExportingAttendance?: boolean;
  allowReviewAction?: boolean;
}

export default function SessionCard({
  session,
  onEdit,
  onEnd,
  onDelete,
  currentUserId,
  showActions = true,
  canExportAttendance = false,
  onExportAttendance,
  isExportingAttendance = false,
  allowReviewAction = false,
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

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isHost = currentUserId === session.host_id;
  const isActive = session.end_time === null;
  const isPast = session.end_time !== null && new Date(session.end_time) < new Date();

  const borderColor = isActive ? "var(--color-correct)" : "var(--color-border-default)";
  const bgColor = isActive ? "#f0fdf4" : "var(--color-surface-card)";

  return (
    <div
      className="rounded-xl p-4"
      style={{
        border: `1.5px solid ${borderColor}`,
        background: bgColor,
        fontFamily: "Plus Jakarta Sans, sans-serif",
      }}
    >
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <h3
              style={{
                fontFamily: "Oswald, sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: "var(--color-text-primary)",
              }}
            >
              {session.metadata?.topic || "Buổi học chưa có tên"}
            </h3>
            {isActive && (
              <span
                className="ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                style={{ background: "var(--color-correct)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                Đang diễn ra
              </span>
            )}
            {isPast && (
              <span
                className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                style={{
                  background: "var(--color-surface-subtle)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Đã kết thúc
              </span>
            )}
          </div>

          <p className="text-xs mb-3" style={{ color: "var(--color-brand)", fontWeight: 600 }}>
            {session.class.name}
          </p>

          <div className="space-y-1">
            <div className="flex items-start gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <p>
                  {formatDateTime(session.start_time)}
                  {session.end_time && ` — ${formatTime(session.end_time)}`}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                  ({userTimezone})
                </p>
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <User className="w-3.5 h-3.5" />
              Người chủ trì:{" "}
              <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                {session.host.full_name}
              </span>
            </p>
            {(session.attendance_summary?.total_attendees !== undefined ||
              session.metadata?.attendees_count !== undefined) && (
              <p className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <Users className="w-3.5 h-3.5" />
                Người tham gia:{" "}
                <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                  {session.attendance_summary?.total_attendees ?? session.metadata?.attendees_count}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {isActive && (
            <button
              onClick={() => router.push(`/sessions/${session.id}/meet`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#FF6B35", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              <Video className="w-4 h-4" />
              Tham gia buổi học
            </button>
          )}

          {canExportAttendance && isPast && onExportAttendance && (
            <button
              onClick={() => onExportAttendance(session)}
              disabled={isExportingAttendance}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingAttendance ? "Đang tải..." : "See attendance"}
            </button>
          )}

          {allowReviewAction && isPast && (
            <button
              onClick={() => router.push(`/sessions/${session.id}/review`)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              Xem lại buổi học
            </button>
          )}

          {showActions && isHost && (
            <div className="flex flex-row md:flex-col gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(session)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Chỉnh sửa
                </button>
              )}
              {isActive && onEnd && (
                <button
                  onClick={() => onEnd(session.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Kết thúc
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(session.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: "var(--color-error)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Xóa
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
