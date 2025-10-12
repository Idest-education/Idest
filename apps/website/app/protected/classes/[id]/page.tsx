"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getClassById } from "@/services/class.service";
import { ClassDetail } from "@/types/class";
import DefaultAvatar from "@/assets/default-avatar.png";
import { BookOpen, Users, Calendar, Clock, Award, Video, Copy, CheckCircle2 } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";

export default function ClassDetailPage() {
  const { id } = useParams();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    getClassById(id as string)
      .then((res) => setClassData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const handleCopyCode = () => {
    if (!classData?.invite_code) return;
    navigator.clipboard.writeText(classData.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Class not found.</p>
        </div>
      </div>
    );
  }

  const { name, description, creator, schedule, _count, members, teachers, sessions } = classData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Header Card */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl shadow-xl p-8 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <BookOpen className="w-8 h-8" />
                <h1 className="text-3xl md:text-4xl font-bold">{name}</h1>
              </div>
              <p className="text-indigo-100 text-lg mb-4">{description}</p>
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 w-fit">
                <Award className="w-4 h-4" />
                <p className="text-sm">
                  Created by <span className="font-semibold">{creator.full_name}</span> • {creator.role}
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-2 px-5 py-3 bg-white text-indigo-600 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold"
              >
                {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? "Copied!" : "Copy Invite Code"}
              </button>
              <p className="text-center text-sm mt-3 font-mono bg-white/20 rounded-lg px-3 py-2">
                {classData.invite_code}
              </p>
            </div>
          </div>
        </div>

        {/* Schedule Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-800">Class Schedule</h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {schedule.days?.map((d) => (
              <span
                key={d}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-medium capitalize shadow-md"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-gray-700">
            <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg">
              <Clock className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold">{schedule.time}</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
              <span className="font-semibold">{schedule.duration} minutes</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <Users className="w-8 h-8 mb-3 opacity-90" />
            <p className="text-4xl font-bold mb-1">{_count.members}</p>
            <p className="text-blue-100 font-medium">Members</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <Award className="w-8 h-8 mb-3 opacity-90" />
            <p className="text-4xl font-bold mb-1">{_count.teachers}</p>
            <p className="text-purple-100 font-medium">Teachers</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <BookOpen className="w-8 h-8 mb-3 opacity-90" />
            <p className="text-4xl font-bold mb-1">{_count.sessions}</p>
            <p className="text-indigo-100 font-medium">Learning Sessions</p>
          </div>
        </div>

        {/* Teachers Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
          <div className="flex items-center gap-3 mb-5">
            <Award className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-800">Teachers</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((t) => (
              <div key={t.id} className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-200 hover:shadow-md transition-shadow">
                <Image
                  src={DefaultAvatar}
                  alt={t.full_name}
                  width={56}
                  height={56}
                  className="rounded-full ring-4 ring-white shadow-md"
                />
                <div>
                  <p className="font-bold text-gray-800">{t.full_name}</p>
                  <p className="text-sm text-purple-600 font-medium">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Members Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
          <div className="flex items-center gap-3 mb-5">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">Class Members</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {members.map((m) => (
              <div key={m.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl text-center border border-blue-200 hover:shadow-md hover:scale-105 transition-all">
                <Image
                  src={DefaultAvatar}
                  alt={m.full_name}
                  width={60}
                  height={60}
                  className="mx-auto rounded-full ring-4 ring-white shadow-md"
                />
                <p className="mt-3 text-sm font-semibold text-gray-800 line-clamp-2">{m.full_name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sessions Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
          <div className="flex items-center gap-3 mb-5">
            <Video className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-800">Learning Sessions</h2>
          </div>
          <div className="space-y-4">
            {sessions.map((s) => (
              <div key={s.id} className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-800 mb-2">
                      📖 {s.metadata?.topic || "Untitled session"}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        {formatDateTime(s.start_time)} → {formatTime(s.end_time)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        Host: <span className="font-semibold text-gray-800">{s.host.full_name}</span>
                        <span className="mx-2">•</span>
                        Attendees: <span className="font-semibold text-gray-800">{s.metadata?.attendees_count ?? 0}</span>
                      </p>
                    </div>
                  </div>
                  {s.is_recorded && (
                    <a
                      href={s.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 hover:shadow-lg transition-all"
                    >
                      <Video className="w-5 h-5" />
                      Watch Recording
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}