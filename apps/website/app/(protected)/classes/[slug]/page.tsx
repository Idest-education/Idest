"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getClassBySlug } from "@/services/class.service";
import {
  getClassSessions,
  getAllSessions,
  endSession,
  deleteSession,
} from "@/services/session.service";
import { ClassDetail } from "@/types/class";
import { SessionData, PaginatedResponse } from "@/types/session";
import DefaultAvatar from "@/assets/default-avatar.png";
import { BookOpen, Users, Clock, Award, Copy, CheckCircle2, PlusCircle } from "lucide-react";
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

  const [showChatPopup, setShowChatPopup] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [classSessions, setClassSessions] = useState<SessionData[]>([]);
  const [sessionFilter, setSessionFilter] = useState<"upcoming" | "past">("upcoming");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState<string>("");

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
    setShowChatPopup(true);
    setReceiverName(fullName);
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const res = await endSession(sessionId);
      if (res.statusCode === 200) {
        refreshSessions();
      } else {
        alert(res.message || "Failed to end session");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      alert(errorMessage);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      const res = await deleteSession(sessionId);
      if (res.statusCode === 200) {
        refreshSessions();
      } else {
        alert(res.message || "Failed to delete session");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      alert(errorMessage);
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
          <p className="text-gray-600 text-lg">Class not found.</p>
        </div>
      </div>
    );
  }

  const { name, description, creator, schedule, _count, members, teachers } = classData;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">

        {/* Header */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">{name}</h1>
              <p className="text-gray-600 mb-4">{description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Created by</span>
                <span className="font-medium text-gray-900">{creator.full_name}</span>
                <span>•</span>
                <span>{creator.role}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Invite Code"}
              </button>
              <p className="text-center text-xs font-mono text-gray-600">
                {classData.invite_code}
              </p>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Schedule</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {schedule.days?.map((d) => (
              <span
                key={d}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium capitalize"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{schedule.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{schedule.duration} minutes</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-6">
            <Users className="w-6 h-6 text-gray-600 mb-3" />
            <p className="text-3xl font-semibold text-gray-900 mb-1">{_count.members}</p>
            <p className="text-sm text-gray-600">Members</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6">
            <Award className="w-6 h-6 text-gray-600 mb-3" />
            <p className="text-3xl font-semibold text-gray-900 mb-1">{_count.teachers}</p>
            <p className="text-sm text-gray-600">Teachers</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6">
            <BookOpen className="w-6 h-6 text-gray-600 mb-3" />
            <p className="text-3xl font-semibold text-gray-900 mb-1">{_count.sessions}</p>
            <p className="text-sm text-gray-600">Learning Sessions</p>
          </div>
        </div>

        {/* Teachers Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Teachers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((t) => (
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Members</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                onConversationCreated={handleOpenConversation} // 👈 truyền callback
              />
            ))}
          </div>

          {/* Chat Popup hiển thị sau khi tạo hội thoại */}
          {showChatPopup && activeConversationId && (
            <div className="fixed bottom-6 right-6 z-50">
              <ConversationPopup
                onClose={() => setShowChatPopup(false)}
                defaultConversationId={activeConversationId} // 👈 mở sẵn ChatWindow
                receiverName={receiverName}
              />
            </div>
          )}
        </div>

        {/* Sessions Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Sessions</h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <Button
                  variant={sessionFilter === "upcoming" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSessionFilter("upcoming")}
                >
                  Upcoming
                </Button>
                <Button
                  variant={sessionFilter === "past" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSessionFilter("past")}
                >
                  Past
                </Button>
              </div>
              {(userRole === "TEACHER" || userRole === "ADMIN") && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gray-900 text-white hover:bg-gray-800 font-medium flex items-center gap-2"
                  size="sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create Session
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {classSessions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No sessions yet
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