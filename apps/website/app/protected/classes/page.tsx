"use client";

import { useEffect, useState } from "react";
import { getClasses, searchClasses } from "@/services/class.service";
import ClassesSection from "@/components/class/class-section";
import { ClassResponse, ClassData } from "@/types/class";
import { BookOpen, GraduationCap, Users, Sparkles, Search } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl shadow-xl p-8 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">My English Classes</h1>
                <p className="text-indigo-100 mt-1">
                  Manage and explore your learning journey
                </p>
              </div>
            </div>

            {/* Nhóm 2 nút lại chung */}
            <div className="flex items-center gap-3">
              {(userRole === "TEACHER" || userRole === "ADMIN") && (
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="bg-white/20 text-white hover:bg-white/30 font-semibold flex items-center gap-2 shadow-md border border-white/40"
                >
                  <PlusCircle className="w-5 h-5" />
                  Add Class
                </Button>
              )}
              <Button
                onClick={() => setShowJoinModal(true)}
                className="bg-white/20 text-white hover:bg-white/30 font-semibold flex items-center gap-2 shadow-md border border-white/40"
              >
                <Users className="w-5 h-5" />
                Join Class
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-6 flex items-center bg-white/20 rounded-xl px-4 py-2 backdrop-blur-sm focus-within:ring-2 focus-within:ring-white/70 transition-all">
            <Search className="w-5 h-5 text-white/80 mr-3" />
            <input
              type="text"
              placeholder="Search for classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder-white/60 outline-none text-base"
            />
          </div>

          {/* Stats Summary */}
          {hasClasses && (
            <div className="flex flex-wrap gap-4 mt-6">
              {classes.created.length > 0 && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    {classes.created.length} Created
                  </span>
                </div>
              )}
              {classes.teaching.length > 0 && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    {classes.teaching.length} Teaching
                  </span>
                </div>
              )}
              {classes.enrolled.length > 0 && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    {classes.enrolled.length} Enrolled
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Search Results
              </h2>
              {searching && (
                <span className="text-gray-500 text-sm italic">Searching...</span>
              )}
              {!searching && (
                <span className="ml-auto px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                  {searchResults.length} found
                </span>
              )}
            </div>

            {searchResults.length > 0 ? (
              <ClassesSection title="" classes={searchResults} />
            ) : (
              !searching && (
                <p className="text-gray-500 text-center py-4">
                  No classes found for “{searchQuery}”
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
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Created Classes
                    </h2>
                    <span className="ml-auto px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
                      {classes.created.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.created} />
                </div>
              )}

              {classes.teaching.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Teaching Classes
                    </h2>
                    <span className="ml-auto px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                      {classes.teaching.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.teaching} />
                </div>
              )}

              {classes.enrolled.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Enrolled Classes
                    </h2>
                    <span className="ml-auto px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                      {classes.enrolled.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.enrolled} />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="w-10 h-10 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                  No Classes Yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Start your English learning journey by creating or joining a class!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                    Create a Class
                  </button>
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all"
                  >
                    Join a Class
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
