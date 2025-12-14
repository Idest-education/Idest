"use client";

import { useEffect, useState } from "react";
import { getClasses, searchClasses } from "@/services/class.service";
import ClassesSection from "@/components/class/class-section";
import { ClassResponse, ClassData } from "@/types/class";
import { GraduationCap, Users, Search, BookOpen, X } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle } from "lucide-react";
import AddClassModal from "@/components/class/add-class-modal";
import JoinClassModal from "@/components/class/join-class-modal";

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassResponse>({
    created: [],
    teaching: [],
    enrolled: [],
  });
  const [loading, setLoading] = useState(true);

  // --- Thêm các state cho tìm kiếm ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClassData[]>([]);
  const [searching, setSearching] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        setUserRole(data.user?.user_metadata?.role || null);
      } catch (err) {
        console.error("Error fetching session:", err);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    getClasses()
      .then((data) => {
        setClasses(data?.data || { created: [], teaching: [], enrolled: [] });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // --- Debounce search ---
  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        setSearching(true);
        searchClasses(searchQuery)
          .then((data) => setSearchResults(data?.data || []))
          .catch((err) => console.error(err))
          .finally(() => setSearching(false));
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  if (loading) return <LoadingScreen />;

  const hasClasses =
    classes.created.length > 0 ||
    classes.teaching.length > 0 ||
    classes.enrolled.length > 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Column - Text Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 via-orange-100 to-orange-100 text-xs font-medium text-gray-800 shadow-sm mb-4 hover:shadow-md transition-shadow duration-300">
                <GraduationCap className="w-4 h-4 text-orange-500 animate-pulse" />
                Học tập cùng nhau, phát triển cùng nhau
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-0 bg-gradient-to-r from-gray-900 via-orange-900 to-orange-800 bg-clip-text text-transparent">
                  Lớp học
                </h1>
                <div className="flex items-center gap-2">
                  {(userRole === "TEACHER" || userRole === "ADMIN") && (
                    <Button
                      onClick={() => setShowAddModal(true)}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Tạo lớp học
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowJoinModal(true)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Tham gia lớp học
                  </Button>
                </div>
              </div>
              <p className="text-gray-600 max-w-2xl mt-2">
                Quản lý lớp học và hành trình học tập của bạn. Tạo, tham gia và khám phá các lớp học mới.
              </p>
            </div>

            {/* Right Column - Stats Summary */}
            {hasClasses && (
              <div className="relative h-64 lg:h-80 rounded-2xl overflow-hidden shadow-xl group bg-gradient-to-br from-orange-50 via-orange-50 to-amber-50 p-6 flex flex-col justify-center">
                <div className="space-y-4">
                  {classes.created.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <BookOpen className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{classes.created.length}</p>
                        <p className="text-sm text-gray-600">Lớp đã tạo</p>
                      </div>
                    </div>
                  )}
                  {classes.teaching.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <GraduationCap className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{classes.teaching.length}</p>
                        <p className="text-sm text-gray-600">Đang giảng dạy</p>
                      </div>
                    </div>
                  )}
                  {classes.enrolled.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Users className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{classes.enrolled.length}</p>
                        <p className="text-sm text-gray-600">Đã ghi danh</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 animate-in fade-in slide-in-from-top-4">
          <div className="relative max-w-md group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-orange-500 transition-colors duration-300" />
            <Input
              type="text"
              placeholder="Tìm kiếm lớp học theo tên hoặc mô tả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 w-full transition-all duration-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:scale-110 transition-all duration-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600 animate-in fade-in slide-in-from-top-2">
              {searching ? "Đang tìm kiếm..." : searchResults.length > 0 ? `Tìm thấy ${searchResults.length} lớp học` : "Không tìm thấy lớp học nào"}
            </p>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            {searching ? (
              <div className="py-24 flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                  <p className="text-gray-600 text-sm">Đang tìm kiếm...</p>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              <ClassesSection title="" classes={searchResults} />
            ) : (
              <div className="border border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gradient-to-br from-white via-gray-50 to-gray-100">
                <div className="max-w-md mx-auto space-y-4">
                  <Search className="w-10 h-10 mx-auto text-gray-400" />
                  <h3 className="text-2xl font-semibold text-gray-900">Không tìm thấy lớp học</h3>
                  <p className="text-gray-600">
                    Không tìm thấy lớp học nào cho &quot;{searchQuery}&quot;
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                    className="mt-4"
                  >
                    Xóa tìm kiếm
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Classes Sections */}
        {!searchQuery.trim() && (
          hasClasses ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              {classes.created.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Đã tạo bởi bạn
                    </h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {classes.created.length} lớp học
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.created} />
                </div>
              )}

              {classes.teaching.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Đang giảng dạy
                    </h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {classes.teaching.length} lớp học
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.teaching} />
                </div>
              )}

              {classes.enrolled.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Đã ghi danh
                    </h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {classes.enrolled.length} lớp học
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.enrolled} />
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gradient-to-br from-white via-gray-50 to-gray-100 animate-in fade-in slide-in-from-bottom-4">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-100 rounded-full flex items-center justify-center mx-auto">
                  <GraduationCap className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900">
                  Chưa có lớp học nào
                </h3>
                <p className="text-gray-600">
                  Bắt đầu bằng cách tạo hoặc tham gia một lớp học để bắt đầu hành trình học tập của bạn.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                  {(userRole === "TEACHER" || userRole === "ADMIN") && (
                    <Button 
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Tạo lớp học
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowJoinModal(true)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Tham gia lớp học
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
        {/* Modal tạo lớp học */}
        <AddClassModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            getClasses().then((data) =>
              setClasses(data?.data || { created: [], teaching: [], enrolled: [] })
            );
          }}
        />

        <JoinClassModal
          open={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            getClasses().then((data) =>
              setClasses(data?.data || { created: [], teaching: [], enrolled: [] })
            );
          }}
        />
      </div>
    </div>
  );
}
