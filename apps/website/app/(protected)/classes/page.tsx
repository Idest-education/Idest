"use client";

import { useEffect, useState } from "react";
import { getClasses, searchClasses } from "@/services/class.service";
import ClassesSection from "@/components/class/class-section";
import { ClassResponse, ClassData } from "@/types/class";
import { GraduationCap, Users, Search } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
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
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Page Header */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">Lớp học</h1>
              <p className="text-gray-600">
                Quản lý lớp học và hành trình học tập của bạn
              </p>
            </div>

            {/* Add Class, Join Class Button */}
            <div className="flex items-center gap-3">
              {(userRole === "TEACHER" || userRole === "ADMIN") && (
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="bg-gray-900 text-white hover:bg-gray-800 font-medium flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  Tạo lớp học
                </Button>
              )}
              <Button
                onClick={() => setShowJoinModal(true)}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Tham gia lớp học
              </Button>
            </div>
          </div>

          {/* Search Bar & Stats */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm lớp học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              />
            </div>

            {/* Stats Summary */}
            {hasClasses && (
              <div className="flex flex-wrap gap-3">
                {classes.created.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-700">
                    <span className="font-medium">{classes.created.length}</span>
                    <span className="text-gray-500">Đã tạo</span>
                  </div>
                )}
                {classes.teaching.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-700">
                    <span className="font-medium">{classes.teaching.length}</span>
                    <span className="text-gray-500">Đang giảng dạy</span>
                  </div>
                )}
                {classes.enrolled.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-700">
                    <span className="font-medium">{classes.enrolled.length}</span>
                    <span className="text-gray-500">Đã ghi danh</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Kết quả tìm kiếm
              </h2>
              {searching && (
                <span className="text-gray-500 text-sm">Đang tìm kiếm...</span>
              )}
              {!searching && (
                <span className="text-sm text-gray-600">
                  {searchResults.length} kết quả
                </span>
              )}
            </div>

            {searchResults.length > 0 ? (
              <ClassesSection title="" classes={searchResults} />
            ) : (
              !searching && (
                <p className="text-gray-500 text-center py-8">
                  Không tìm thấy lớp học nào cho &quot;{searchQuery}&quot;
                </p>
              )
            )}
          </div>
        )}

        {/* Classes Sections */}
        {!searchQuery.trim() && (
          hasClasses ? (
            <div className="space-y-8">
              {classes.created.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Đã tạo bởi bạn
                    </h2>
                    <span className="text-sm text-gray-500">
                      {classes.created.length} lớp học
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.created} />
                </div>
              )}

              {classes.teaching.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Đang giảng dạy
                    </h2>
                    <span className="text-sm text-gray-500">
                      {classes.teaching.length} lớp học
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.teaching} />
                </div>
              )}

              {classes.enrolled.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Đã ghi danh
                    </h2>
                    <span className="text-sm text-gray-500">
                      {classes.enrolled.length} lớp học
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.enrolled} />
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Chưa có lớp học nào
                </h3>
                <p className="text-gray-600 mb-6">
                  Bắt đầu bằng cách tạo hoặc tham gia một lớp học
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {(userRole === "TEACHER" || userRole === "ADMIN") && (
                    <button 
                      onClick={() => setShowAddModal(true)}
                      className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                      Tạo lớp học
                    </button>
                  )}
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Tham gia lớp học
                  </button>
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
