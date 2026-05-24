"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { getSessionById, getSessionAttendance } from "@/services/session.service";
import { getClassMembers, UserSummary } from "@/services/class.service";
import {
  getRecordingUrl,
  listSessionRecordings,
  MeetRecordingListItem,
} from "@/services/meet.service";
import { SessionAttendanceSummaryDto, SessionData } from "@/types/session";

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(totalSeconds?: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return "N/A";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getSessionDurationSeconds(session: SessionData | null) {
  if (!session?.end_time) return null;
  const start = new Date(session.start_time).getTime();
  const end = new Date(session.end_time).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.floor((end - start) / 1000);
}

function getRecordingDurationSeconds(recording: MeetRecordingListItem | null) {
  if (!recording?.startedAt || !recording.stoppedAt) return null;
  const start = new Date(recording.startedAt).getTime();
  const end = new Date(recording.stoppedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.floor((end - start) / 1000);
}

export default function SessionReviewPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params?.sessionId;

  const [session, setSession] = useState<SessionData | null>(null);
  const [attendance, setAttendance] = useState<SessionAttendanceSummaryDto | null>(null);
  const [recordings, setRecordings] = useState<MeetRecordingListItem[]>([]);
  const [classStudents, setClassStudents] = useState<UserSummary[]>([]);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [sessionRaw, attendanceRaw] = await Promise.all([
          getSessionById(sessionId),
          getSessionAttendance(sessionId).catch(() => null),
        ]);
        const sessionRes = sessionRaw as SessionData;
        const attendanceRes = attendanceRaw as SessionAttendanceSummaryDto | null;

        setSession(sessionRes);
        setAttendance(attendanceRes);

        const members = await getClassMembers(sessionRes.class_id).catch(() => []);
        const studentsOnly = members.filter(
          (member) => member.role?.toLowerCase().includes("student"),
        );
        setClassStudents(studentsOnly);

        const recordingsRes = await listSessionRecordings(sessionId).catch(() => ({
          sessionId,
          items: [],
        }));
        const recordingItems = recordingsRes.items || [];
        setRecordings(recordingItems);

        const firstRecordingWithId = recordingItems.find((item) => item.recordingId);
        if (firstRecordingWithId?.recordingId) {
          const recordingUrlRes = await getRecordingUrl(firstRecordingWithId.recordingId).catch(
            () => null,
          );
          // Prefer backend-resolved playback URL (presigned when storage is private).
          setPlaybackUrl(recordingUrlRes?.url ?? firstRecordingWithId.url ?? sessionRes.recording_url ?? null);
        } else {
          const firstDirectUrl = recordingItems.find((item) => item.url)?.url ?? null;
          setPlaybackUrl(firstDirectUrl ?? sessionRes.recording_url ?? null);
        }
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err && typeof err.message === "string"
            ? err.message
            : "Không thể tải dữ liệu buổi học.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  const primaryRecording = useMemo(
    () => recordings.find((recording) => recording.recordingId) || null,
    [recordings],
  );

  const title = session?.metadata?.topic || session?.class?.name || "Buổi học";
  const recordingDuration = getRecordingDurationSeconds(primaryRecording);
  const sessionDuration = getSessionDurationSeconds(session);
  const lengthText = formatDuration(recordingDuration ?? sessionDuration);
  const attendanceByUserId = useMemo(() => {
    const map = new Map<string, SessionAttendanceSummaryDto["attendees"][number]>();
    attendance?.attendees?.forEach((item) => {
      map.set(item.user_id, item);
    });
    return map;
  }, [attendance]);

  const participantItems = attendance?.attendees ?? [];
  const visibleStudentItems = showAllStudents
    ? classStudents.map((student) => {
        const attendee = attendanceByUserId.get(student.id);
        return {
          key: student.id,
          fullName: student.full_name || "Người dùng không xác định",
          joinedAt: attendee?.joined_at ?? null,
          durationSeconds: attendee?.duration_seconds ?? null,
          isAttended: !!attendee?.is_attended,
          isAbsent: !attendee,
        };
      })
    : participantItems.map((attendee) => ({
        key: attendee.id,
        fullName: attendee.user?.full_name || "Người dùng không xác định",
        joinedAt: attendee.joined_at ?? null,
        durationSeconds: attendee.duration_seconds ?? null,
        isAttended: attendee.is_attended,
        isAbsent: false,
      }));

  const handleDownloadRecording = () => {
    if (!playbackUrl) return;
    const topic = (title || "session").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const datePart = session?.start_time ? new Date(session.start_time).toISOString().split("T")[0] : "recording";
    const filename = `recording_${topic}_${datePart}.mp4`;
    const link = document.createElement("a");
    link.href = playbackUrl;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadParticipation = () => {
    if (!session) return;

    const rows = visibleStudentItems.map((item) => {
      const matchingStudent = classStudents.find((student) => student.id === item.key);
      const status = item.isAbsent
        ? "Vắng"
        : item.isAttended
          ? "Đã tham gia"
          : "Không đủ điều kiện điểm danh";

      return {
        "Full Name": item.fullName,
        Email: matchingStudent?.email || "",
        "Joined At": item.isAbsent ? "N/A" : formatDateTime(item.joinedAt),
        Duration: item.isAbsent ? "N/A" : formatDuration(item.durationSeconds),
        Status: status,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 30 },
      { wch: 30 },
      { wch: 22 },
      { wch: 14 },
      { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Participation");

    const datePart = session.start_time ? new Date(session.start_time).toISOString().split("T")[0] : "session";
    const topic = (title || "session").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `participation_${topic}_${datePart}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-app)" }}>
      {/* Warm header band */}
      <div
        className="px-6 py-6"
        style={{
          background: "linear-gradient(160deg, #fff4ed 0%, #ffe8d6 100%)",
          borderBottom: "1.5px solid var(--color-border-default)",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1
              style={{
                fontFamily: "Oswald, sans-serif",
                fontWeight: 700,
                fontSize: 28,
                color: "var(--color-text-primary)",
              }}
            >
              {title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {session ? formatDateTime(session.start_time) : "Xem lại buổi học"}
            </p>
          </div>
          <button
            onClick={() => router.push("/sessions")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: "var(--color-surface-card)",
              border: "1.5px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {loading ? (
          <div
            className="rounded-xl p-10 text-center text-sm"
            style={{
              background: "var(--color-surface-card)",
              border: "1.5px solid var(--color-border-default)",
              color: "var(--color-text-muted)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            Đang tải dữ liệu...
          </div>
        ) : (
          <>
            {error && (
              <div
                className="rounded-xl p-4 text-sm"
                style={{
                  background: "#fff5f5",
                  border: "1.5px solid #fecaca",
                  color: "var(--color-error)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left: video + info */}
              <div className="lg:col-span-2 space-y-4">
                {/* Video panel */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ background: "#111", border: "1.5px solid var(--color-border-default)" }}
                >
                  {playbackUrl ? (
                    <video
                      controls
                      src={playbackUrl}
                      className="w-full max-h-[540px]"
                      style={{ background: "#111" }}
                    >
                      Trình duyệt của bạn không hỗ trợ video.
                    </video>
                  ) : (
                    <div className="p-10 text-center text-sm" style={{ color: "rgba(255,250,245,0.4)" }}>
                      Chưa có bản ghi cho buổi học này.
                    </div>
                  )}
                </div>

                {/* Download actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleDownloadRecording}
                    disabled={!playbackUrl}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                  >
                    <Download className="w-4 h-4" />
                    Tải video
                  </button>
                  <button
                    onClick={handleDownloadParticipation}
                    disabled={!session}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1.5px solid var(--color-border-default)",
                      color: "var(--color-text-primary)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Tải điểm danh
                  </button>
                </div>

                {/* Info block — label/value list, not a Card */}
                <div
                  className="rounded-xl p-5 space-y-3"
                  style={{
                    background: "var(--color-surface-subtle)",
                    border: "1.5px solid var(--color-border-default)",
                  }}
                >
                  {[
                    { label: "Chủ đề", value: title },
                    { label: "Lớp học", value: session?.class?.name ?? "N/A" },
                    { label: "Thời lượng", value: lengthText },
                    {
                      label: "Thời gian",
                      value: session
                        ? `${formatDateTime(session.start_time)}${session.end_time ? ` — ${formatDateTime(session.end_time)}` : ""}`
                        : "N/A",
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-4 items-baseline">
                      <span
                        className="w-28 flex-shrink-0 text-xs uppercase tracking-widest"
                        style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-sm"
                        style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: attendance sidebar */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                }}
              >
                {/* Sidebar header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    background: "var(--color-surface-subtle)",
                    borderBottom: "1.5px solid var(--color-border-default)",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {showAllStudents ? "Tất cả học viên" : "Học viên tham gia"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadParticipation}
                      className="p-1.5 rounded-lg"
                      style={{
                        background: "var(--color-surface-card)",
                        border: "1.5px solid var(--color-border-default)",
                        color: "var(--color-text-muted)",
                      }}
                      title="Tải điểm danh"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowAllStudents((prev) => !prev)}
                      className="p-1.5 rounded-lg"
                      style={{
                        background: "var(--color-surface-card)",
                        border: "1.5px solid var(--color-border-default)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {showAllStudents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Student list */}
                <div className="max-h-[640px] overflow-y-auto">
                  {visibleStudentItems.length ? (
                    <div className="divide-y" style={{ borderColor: "var(--color-border-default)" }}>
                      {visibleStudentItems.map((item) => (
                        <div key={item.key} className="flex items-center justify-between px-4 py-3 gap-3">
                          <div className="min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                            >
                              {item.fullName}
                            </p>
                            {!item.isAbsent && (
                              <p
                                className="text-xs"
                                style={{ color: "var(--color-text-muted)", fontFamily: "JetBrains Mono, monospace" }}
                              >
                                {formatDuration(item.durationSeconds)}
                              </p>
                            )}
                          </div>
                          <span
                            className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={
                              item.isAbsent
                                ? {
                                    background: "var(--color-surface-muted)",
                                    color: "var(--color-text-muted)",
                                  }
                                : item.isAttended
                                  ? { background: "#dcfce7", color: "#166534" }
                                  : {
                                      background: "var(--color-surface-subtle)",
                                      color: "var(--color-text-secondary)",
                                    }
                            }
                          >
                            {item.isAbsent ? "Vắng" : item.isAttended ? "Đã tham gia" : "Chưa đủ điều kiện"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      className="text-center py-8 text-sm"
                      style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      {showAllStudents ? "Chưa có dữ liệu học viên." : "Chưa có dữ liệu người tham gia."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
