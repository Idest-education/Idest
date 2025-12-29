"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getClassBySlug } from "@/services/class.service";
import { conversationService } from "@/services/conversation.service";
import {
  getClassSessions,
  getAllSessions,
  endSession,
  deleteSession,
  getSessionAttendance,
} from "@/services/session.service";
import { ClassDetail } from "@/types/class";
import { SessionData, PaginatedResponse } from "@/types/session";
import DefaultAvatar from "@/assets/default-avatar.png";
import { BookOpen, Users, Clock, Award, Copy, CheckCircle2, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import LoadingScreen from "@/components/loading-screen";
import MemberCard from "@/components/class/member-card";
import ConversationPopup from "@/components/conversation/ConversationPopup";
import SessionCard from "@/components/session/session-card";
import CreateSessionModal from "@/components/session/create-session-modal";
import { Button } from "@/components/ui/button";

export default function ClassDetailPage() {
  const { slug } = useParams();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationName, setActiveConversationName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [classConversationId, setClassConversationId] = useState<string | null>(null);

  const [classSessions, setClassSessions] = useState<SessionData[]>([]);
  const [sessionFilter, setSessionFilter] = useState<"upcoming" | "past">("upcoming");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        setCurrentUserId(data.user?.id || "");
        setUserRole(data.user?.user_metadata?.role || null);
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (!slug) return;
    getClassBySlug(slug as string)
      .then((res) => setClassData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  // Preload class group conversation (if any)
  useEffect(() => {
    if (!classData?.id) return;
    conversationService
      .getUserConversations({ limit: 100 })
      .then((res) => {
        const conv = res.items.find((c) => c.classId === classData.id);
        setClassConversationId(conv?.id ?? null);
      })
      .catch(() => setClassConversationId(null));
  }, [classData?.id]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!classData?.id) return;
      try {
        let sessions: SessionData[] = [];

        // For teachers and admins, use getAllSessions() and filter by class
        // For students, use getClassSessions() to get class-specific sessions
        if (userRole === "TEACHER" || userRole === "ADMIN") {
          const res = await getAllSessions({ limit: 100 }); // Get more sessions since we're filtering locally
          const allSessions = Array.isArray(res.data) 
            ? res.data 
            : (res.data as PaginatedResponse<SessionData>).data || [];
          // Filter sessions for this class
          sessions = allSessions.filter((s: SessionData) => s.class_id === classData.id);
        } else {
          const res = await getClassSessions(classData.id, { limit: 50 });
          sessions = Array.isArray(res.data) 
            ? res.data 
            : (res.data as PaginatedResponse<SessionData>).data || [];
        }

        setClassSessions(sessions);
      } catch (err) {
        console.error("Error fetching sessions:", err);
      }
    };

    if (classData?.id && userRole !== null) {
      loadSessions();
    }
  }, [classData?.id, userRole]);

  const refreshSessions = async () => {
    if (!classData?.id) return;
    try {
      let sessions: SessionData[] = [];

      // For teachers and admins, use getAllSessions() and filter by class
      // For students, use getClassSessions() to get class-specific sessions
        if (userRole === "TEACHER" || userRole === "ADMIN") {
          const res = await getAllSessions({ limit: 100 });
          const allSessions = Array.isArray(res.data) 
            ? res.data 
            : (res.data as PaginatedResponse<SessionData>).data || [];
          // Filter sessions for this class
          sessions = allSessions.filter((s: SessionData) => s.class_id === classData.id);
        } else {
          const res = await getClassSessions(classData.id, { limit: 50 });
          sessions = Array.isArray(res.data) 
            ? res.data 
            : (res.data as PaginatedResponse<SessionData>).data || [];
        }

      setClassSessions(sessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  const handleCopyCode = () => {
    if (!classData?.invite_code) return;
    navigator.clipboard.writeText(classData.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenConversation = (conversationId: string, fullName: string) => {
    setActiveConversationId(conversationId);
    setActiveConversationName(fullName);
    setShowChatDrawer(true);
  };

  const handleOpenClassChat = async () => {
    if (!classData?.id) return;
    try {
      let convId = classConversationId;

      // Ensure class conversation exists (for legacy classes)
      if (!convId) {
        const participantSeed = currentUserId || classData.creator.id;
        const conv = await conversationService.createConversation({
          isGroup: true,
          title: classData.name,
          participantIds: [participantSeed],
          classId: classData.id,
        });
        convId = conv.id;
        setClassConversationId(convId);
      }

      setActiveConversationId(convId);
      setActiveConversationName(`${classData.name} (Class chat)`);
      setShowChatDrawer(true);
    } catch (err) {
      console.error(err);
      alert("Không thể mở nhóm chat của lớp.");
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await endSession(sessionId);
      refreshSessions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Đã xảy ra lỗi";
      alert(errorMessage);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa buổi học này?")) return;

    try {
      const res = await deleteSession(sessionId);
      if (res.statusCode === 200) {
        refreshSessions();
      } else {
        alert(res.message || "Không thể xóa buổi học");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Đã xảy ra lỗi";
      alert(errorMessage);
    }
  };

  const handleExportAttendance = async (session: SessionData) => {
    setExportingSessionId(session.id);
    try {
      if (!classData?.members && !classData?.teachers) {
        toast.error("Không thể lấy danh sách thành viên lớp học.");
        return;
      }

      const attendance = await getSessionAttendance(session.id);
      
      // Create a map of user_id -> attendance record for quick lookup
      const attendanceMap = new Map(
        attendance.attendees?.map((a) => [a.user_id, a]) || []
      );

      // Combine members and teachers into a single list
      const allParticipants = [
        ...(classData.members || []),
        ...(classData.teachers || []),
      ];

      // Remove duplicates (in case a teacher is also in members)
      const uniqueParticipants = Array.from(
        new Map(allParticipants.map((p) => [p.id, p])).values()
      );

      // Build Excel data with all class members and teachers
      const rows = uniqueParticipants.map((participant) => {
        const attendee = attendanceMap.get(participant.id);
        return {
          "Full Name": participant.full_name || "",
          "Email": participant.email || "",
          "Role": participant.role || "",
          "Attended": attendee?.is_attended ? "Yes" : "No",
        };
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);

      // Set column widths
      ws["!cols"] = [
        { wch: 30 }, // Full Name
        { wch: 30 }, // Email
        { wch: 15 }, // Role
        { wch: 12 }, // Attended
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      // Generate filename with session date
      const sessionDate = new Date(session.start_time).toISOString().split("T")[0];
      const sessionTopic = (session.metadata?.topic || "session").replace(/[^a-z0-9]/gi, "_");
      const filename = `attendance_${sessionTopic}_${sessionDate}_${session.id.substring(0, 8)}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, filename);
      
      toast.success("Đã tải xuống dữ liệu điểm danh thành công");
    } catch (err) {
      console.error("Error exporting attendance:", err);
      toast.error("Không thể tải xuống dữ liệu điểm danh. Vui lòng thử lại.");
    } finally {
      setExportingSessionId(null);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Không tìm thấy lớp học.</p>
        </div>
      </div>
    );
  }

  const { name, description, creator, schedule, _count, members, teachers } = classData;
  const isStaff = userRole === "TEACHER" || userRole === "ADMIN";

  const memberCount = Array.isArray(members) ? members.length : _count.members;
  const teacherList =
    (Array.isArray(teachers) && teachers.length > 0
      ? teachers
      : Array.isArray(members)
        ? members.filter((m) => m.role === "TEACHER")
        : []);
  const teacherCount =
    teacherList.length > 0 ? teacherList.length : _count.teachers;

  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 py-6 md:py-8 space-y-8">

        {/* Header */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">{name}</h1>
              <p className="text-gray-600 mb-4">{description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Được tạo bởi</span>
                <span className="font-medium text-gray-900">{creator.full_name}</span>
                <span>•</span>
                <span>{creator.role}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleOpenClassChat}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
              >
                Mở nhóm chat lớp
              </button>

              {isStaff && (
                <>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Đã sao chép!" : "Sao chép mã mời"}
                  </button>
                  <p className="text-center text-xs font-mono text-gray-600">
                    {classData.invite_code}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Lịch học</h2>
          {schedule?.days?.length ? (
            <div className="space-y-2">
              {schedule.days.map((day) => (
                <div
                  key={day}
                  className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-4 py-2 text-sm text-gray-800"
                >
                  <span className="font-medium capitalize">{day}</span>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{schedule.time}</span>
                    </span>
                    <span className="text-gray-500">•</span>
                    <span>{schedule.duration} phút</span>
                    {schedule.timezone && (
                      <>
                        <span className="text-gray-500">•</span>
                        <span className="text-xs text-gray-500">{schedule.timezone}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Chưa có lịch học cho lớp này.</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-6">
            <Users className="w-6 h-6 text-gray-600 mb-3" />
            <p className="text-3xl font-semibold text-gray-900 mb-1">{memberCount}</p>
            <p className="text-sm text-gray-600">Thành viên</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6">
            <Award className="w-6 h-6 text-gray-600 mb-3" />
            <p className="text-3xl font-semibold text-gray-900 mb-1">{teacherCount}</p>
            <p className="text-sm text-gray-600">Giáo viên</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6">
            <BookOpen className="w-6 h-6 text-gray-600 mb-3" />
            <p className="text-3xl font-semibold text-gray-900 mb-1">{_count.sessions}</p>
            <p className="text-sm text-gray-600">Buổi học</p>
          </div>
        </div>

        {/* Teachers Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Giáo viên</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacherList.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-900 transition-colors">
                <Image
                  src={DefaultAvatar}
                  alt={t.full_name}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
                <div>
                  <p className="font-medium text-gray-900">{t.full_name}</p>
                  <p className="text-sm text-gray-600">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Members Section */}
        <div className="border border-gray-200 rounded-lg p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Thành viên</h2>
            {Array.isArray(members) && members.length > 6 && (
              <button
                onClick={() => setMembersExpanded(!membersExpanded)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {membersExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Thu gọn
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Xem thêm ({members.length })
                  </>
                )}
              </button>
            )}
          </div>

          {Array.isArray(members) && members.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {(membersExpanded ? members : members.slice(0, 6)).map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  onConversationCreated={handleOpenConversation} // 👈 truyền callback
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Chưa có thành viên nào.</p>
          )}

          {/* Chat Drawer - hiển thị sau khi tạo hội thoại */}
          {mounted && showChatDrawer &&
            createPortal(
              <div className="fixed inset-0 z-[10000]">
                {/* Backdrop */}
                <button
                  type="button"
                  onClick={() => setShowChatDrawer(false)}
                  className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fadeIn"
                  aria-label="Close chat"
                />

                {/* Drawer */}
                <div className="absolute right-0 top-0 h-full w-[920px] max-w-[95vw] bg-white shadow-2xl border-l border-gray-200 animate-fadeIn">
                  <ConversationPopup
                    onClose={() => setShowChatDrawer(false)}
                    activeConversationId={activeConversationId}
                    activeConversationName={activeConversationName}
                    onActiveConversationChange={(id, name) => {
                      setActiveConversationId(id);
                      setActiveConversationName(name ?? null);
                    }}
                    unreadConversationIds={[]}
                    onClearUnread={() => {}}
                  />
                </div>
              </div>,
              document.body,
            )
          }
        </div>

        {/* Sessions Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Buổi học</h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <Button
                  variant={sessionFilter === "upcoming" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSessionFilter("upcoming")}
                >
                  Sắp tới
                </Button>
                <Button
                  variant={sessionFilter === "past" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSessionFilter("past")}
                >
                  Đã qua
                </Button>
              </div>
              {(userRole === "TEACHER" || userRole === "ADMIN") && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gray-900 text-white hover:bg-gray-800 font-medium flex items-center gap-2"
                  size="sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  Tạo buổi học
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {classSessions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Chưa có buổi học nào
              </p>
            ) : (
              classSessions
                .filter((s) => {
                  const now = new Date();
                  const startTime = new Date(s.start_time);
                  if (sessionFilter === "upcoming") {
                    return startTime >= now || s.end_time === null;
                  } else {
                    return s.end_time !== null && new Date(s.end_time) < now;
                  }
                })
                .map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onEnd={handleEndSession}
                    onDelete={handleDeleteSession}
                    currentUserId={currentUserId}
                    canExportAttendance={
                      (userRole === "TEACHER" || userRole === "ADMIN") &&
                      sessionFilter === "past"
                    }
                    onExportAttendance={handleExportAttendance}
                    isExportingAttendance={exportingSessionId === s.id}
                  />
                ))
            )}
          </div>
        </div>
      </div>

      {/* Session Modals */}
      {classData && (
        <>
          <CreateSessionModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreated={refreshSessions}
            classId={classData.id}
            className={classData.name}
          />
        </>
      )}
    </div>
  );
}