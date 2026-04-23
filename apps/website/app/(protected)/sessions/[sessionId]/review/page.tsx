"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, Clock, Download, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="min-h-screen bg-white">
      <div className="px-6 py-6 md:py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Xem lại buổi học</h1>
            <p className="text-gray-600 mt-1">Xem bản ghi và danh sách người tham gia.</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/sessions")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">Đang tải dữ liệu...</CardContent>
          </Card>
        ) : (
          <>
            {error && (
              <Card className="border-red-200">
                <CardContent className="py-4 text-red-600">{error}</CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <Video className="w-5 h-5" />
                        Xem lại
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadRecording}
                        disabled={!playbackUrl}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Tải video
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {playbackUrl ? (
                      <video
                        controls
                        src={playbackUrl}
                        className="w-full rounded-md bg-black max-h-[540px]"
                      >
                        Trình duyệt của bạn không hỗ trợ video.
                      </video>
                    ) : (
                      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
                        Chưa có bản ghi cho buổi học này.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Thông tin buổi học</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-lg font-medium text-gray-900">{title}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Users className="w-4 h-4" />
                      <span>Lớp học: {session?.class?.name ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Clock className="w-4 h-4" />
                      <span>Thời lượng: {lengthText}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <Calendar className="w-4 h-4 mt-0.5" />
                      <span>
                        {formatDateTime(session?.start_time)}
                        {session?.end_time ? ` - ${formatDateTime(session.end_time)}` : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="lg:col-span-1">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {showAllStudents ? "Tất cả học viên" : "Học viên tham gia"}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleDownloadParticipation}>
                        <Download className="w-4 h-4 mr-2" />
                        Tải điểm danh
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAllStudents((prev) => !prev)}
                        className="h-8 w-8 p-0"
                        aria-label={showAllStudents ? "Hiển thị chỉ người tham gia" : "Hiển thị tất cả học viên"}
                        title={showAllStudents ? "Hiển thị chỉ người tham gia" : "Hiển thị tất cả học viên"}
                      >
                        {showAllStudents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {visibleStudentItems.length ? (
                    <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                      {visibleStudentItems.map((item) => (
                        <div key={item.key} className="border rounded-md p-3 space-y-1">
                          <p className="font-medium text-sm text-gray-900">
                            {item.fullName}
                          </p>
                          <p className="text-xs text-gray-600">
                            Vào lớp: {item.isAbsent ? "N/A" : formatDateTime(item.joinedAt)}
                          </p>
                          <p className="text-xs text-gray-600">
                            Thời gian tham gia:{" "}
                            {item.isAbsent ? "N/A" : formatDuration(item.durationSeconds)}
                          </p>
                          <Badge variant={item.isAbsent ? "secondary" : item.isAttended ? "default" : "outline"}>
                            {item.isAbsent
                              ? "Vắng"
                              : item.isAttended
                                ? "Đã tham gia"
                                : "Không đủ điều kiện điểm danh"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {showAllStudents
                        ? "Chưa có dữ liệu học viên trong lớp."
                        : "Chưa có dữ liệu người tham gia."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
