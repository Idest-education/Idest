"use client";

import { useEffect, useState, useMemo } from "react";
import AssignmentCard from "@/components/assignment/assignment-card";
import { getAssignmentsBySkill } from "@/services/assignment.service";
import type { AssignmentOverview, PaginatedAssignmentResponse, PaginationDto } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, BookOpen, X } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import readingImage from "@/assets/assignment-reading.png";
import listeningImage from "@/assets/assignment-listening.png";
import writingImage from "@/assets/assignment-writing.png";
import speakingImage from "@/assets/assignment-speaking.png";

type Skill = "reading" | "listening" | "writing" | "speaking";

const SKILLS: { value: Skill; label: string; icon: string }[] = [
  { value: "reading", label: "Đọc", icon: "📖" },
  { value: "listening", label: "Nghe", icon: "🎧" },
  { value: "writing", label: "Viết", icon: "✍️" },
  { value: "speaking", label: "Nói", icon: "🎤" },
];

const SKILL_IMAGES: Record<Skill, StaticImageData> = {
  reading: readingImage,
  listening: listeningImage,
  writing: writingImage,
  speaking: speakingImage,
};

const ITEMS_PER_PAGE = 6;

export default function AssignmentsPage() {
  const [activeSkill, setActiveSkill] = useState<Skill>("reading");
  const [assignments, setAssignments] = useState<AssignmentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null>(null);

  // Load assignments for the active skill
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const paginationDto: PaginationDto = {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        };
        const response = await getAssignmentsBySkill(activeSkill, paginationDto);
        
        if (response && typeof response === 'object' && 'data' in response && 'pagination' in response) {
          const paginated = response as PaginatedAssignmentResponse;
          setAssignments(paginated.data);
          setPagination(paginated.pagination);
        } else {
          const items = Array.isArray(response) ? response : [];
          setAssignments(items);
          setPagination({
            total: items.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          });
        }
      } catch (error) {
        console.error("Failed to load assignments:", error);
        setAssignments([]);
        setPagination(null);
      } finally {
      setLoading(false);
      }
    }
    load();
  }, [activeSkill, currentPage]);

  // Reset to page 1 when switching tabs or changing search
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSkill, searchQuery]);

  // Filter assignments based on search query
  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) {
      return assignments;
    }
    const query = searchQuery.toLowerCase();
    return assignments.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );
  }, [assignments, searchQuery]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  if (loading && assignments.length === 0) {
    return <LoadingScreen />;
  }

  const totalPages = pagination?.totalPages || 1;
  const totalItems = pagination?.total || filteredAssignments.length;
  const showingFrom = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const showingTo = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8 animate-in fade-in slide-in-from-top-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Column - Text Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 via-pink-100 to-indigo-100 text-xs font-medium text-gray-800 shadow-sm mb-4 hover:shadow-md transition-shadow duration-300">
              <BookOpen className="w-4 h-4 text-indigo-500 animate-pulse" />
              Luyện tập tạo nên sự hoàn hảo
            </div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3 bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
              Bài tập
            </h1>
            <p className="text-gray-600 max-w-2xl">
              Khám phá và luyện tập với bộ sưu tập bài tập IELTS được tuyển chọn qua tất cả các kỹ năng.
            </p>
          </div>

          {/* Right Column - Skill Image */}
          <div className="relative h-64 lg:h-80 rounded-2xl overflow-hidden shadow-xl group bg-gray-100">
            <div className="relative w-full h-full">
              <Image
                key={activeSkill}
                src={SKILL_IMAGES[activeSkill as Skill]}
                alt={`${SKILLS.find(s => s.value === activeSkill)?.label} assignment illustration`}
                fill
                className="object-contain transition-all duration-700 group-hover:scale-105 animate-in fade-in zoom-in-95"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/10 via-transparent to-transparent transition-opacity duration-700 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 animate-in fade-in slide-in-from-top-4">
        <div className="relative max-w-md group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors duration-300" />
          <Input
            type="text"
            placeholder="Tìm kiếm bài tập theo tiêu đề hoặc mô tả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 w-full transition-all duration-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:scale-110 transition-all duration-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600 animate-in fade-in slide-in-from-top-2">
            Tìm thấy {filteredAssignments.length} bài tập trong {SKILLS.find(s => s.value === activeSkill)?.label}
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeSkill} onValueChange={(value) => setActiveSkill(value as Skill)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 p-1.5 bg-gray-100/50 rounded-2xl border border-gray-200 shadow-inner">
          {SKILLS.map((skill, index) => {
            const isActive = activeSkill === skill.value;
            return (
              <TabsTrigger
                key={skill.value}
                value={skill.value}
                className={`relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-500 group overflow-hidden ${
                  isActive
                    ? "text-gray-900 shadow-lg scale-105"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Active state gradient background */}
                {isActive && (
                  <>
                    <span className="absolute inset-0 bg-gradient-to-r from-pink-200 via-purple-200 to-indigo-200 rounded-xl shadow-lg animate-in fade-in duration-500" />
                    {/* Animated shine effect */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 animate-shine" />
                  </>
                )}
                
                {/* Content */}
                <span className="relative z-10 flex items-center gap-2">
                  <span
                    className={`text-lg transition-all duration-300 ${
                      isActive
                        ? "scale-110 rotate-12"
                        : "group-hover:scale-110 group-hover:rotate-12"
                    }`}
                  >
                    {skill.icon}
                  </span>
                  <span
                    className={`transition-all duration-300 ${
                      isActive ? "font-bold" : ""
                    }`}
                  >
                    {skill.label}
                  </span>
                </span>
                
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {SKILLS.map((skill) => (
          <TabsContent key={skill.value} value={skill.value} className="mt-0">
            {loading ? (
              <div className="py-24 flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                  <p className="text-gray-600 text-sm">Đang tải bài tập...</p>
                </div>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gradient-to-br from-white via-gray-50 to-gray-100">
                <div className="max-w-md mx-auto space-y-4">
                  <BookOpen className="w-10 h-10 mx-auto text-gray-400" />
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {searchQuery ? "Không tìm thấy bài tập" : "Chưa có bài tập nào"}
                  </h3>
                  <p className="text-gray-600">
                    {searchQuery
                      ? "Thử điều chỉnh truy vấn tìm kiếm để tìm bài tập."
                      : `Chưa có bài tập ${skill.label.toLowerCase()} nào. Hãy quay lại sau!`}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      onClick={clearSearch}
                      className="mt-4"
                    >
                      Xóa tìm kiếm
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {filteredAssignments.map((item, index) => (
                    <div
                      key={item.id}
                      className="animate-in fade-in slide-in-from-bottom-4"
                      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                    >
                      <AssignmentCard item={item} />
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {!searchQuery && totalPages > 1 && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-4 animate-in fade-in slide-in-from-bottom-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!pagination?.hasPrev || currentPage === 1}
                        className="transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                        Trước
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // Show first page, last page, current page, and pages around current
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <Button
                                key={page}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className={`min-w-[40px] transition-all duration-300 hover:scale-110 ${
                                  currentPage === page
                                    ? "shadow-lg ring-2 ring-indigo-500/50"
                                    : "hover:bg-gray-100"
                                }`}
                              >
                                {page}
                              </Button>
                            );
                          } else if (
                            page === currentPage - 2 ||
                            page === currentPage + 2
                          ) {
                            return (
                              <span key={page} className="px-2 text-gray-400">
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!pagination?.hasNext || currentPage === totalPages}
                        className="transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Sau
                        <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </Button>
                    </div>

                    {/* Page Info */}
                    <div className="text-center text-sm text-gray-600 animate-in fade-in">
                      Hiển thị {showingFrom} đến {showingTo} trong {totalItems} bài tập
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
