"use client";

import { useEffect, useState, useMemo } from "react";
import AssignmentCard from "@/components/assignment/assignment-card";
import { getAssignmentsBySkill } from "@/services/assignment.service";
import type { AssignmentOverview, PaginatedAssignmentResponse, PaginationDto } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import readingImage from "@/assets/assignment-reading.png";
import listeningImage from "@/assets/assignment-listening.png";
import writingImage from "@/assets/assignment-writing.png";
import speakingImage from "@/assets/assignment-speaking.png";

type Skill = "reading" | "listening" | "writing" | "speaking";

const SKILLS: { value: Skill; label: string; image: StaticImageData }[] = [
  { value: "reading", label: "Đọc", image: readingImage },
  { value: "listening", label: "Nghe", image: listeningImage },
  { value: "writing", label: "Viết", image: writingImage },
  { value: "speaking", label: "Nói", image: speakingImage },
];

const SKILL_IMAGES: Record<Skill, StaticImageData> = {
  reading: readingImage,
  listening: listeningImage,
  writing: writingImage,
  speaking: speakingImage,
};

const SKILL_LABELS: Record<Skill, string> = {
  reading: "Đọc hiểu",
  listening: "Nghe",
  writing: "Viết",
  speaking: "Nói",
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const paginationDto: PaginationDto = { page: currentPage, limit: ITEMS_PER_PAGE };
        const response = await getAssignmentsBySkill(activeSkill, paginationDto);

        if (response && typeof response === "object" && "data" in response && "pagination" in response) {
          const paginated = response as PaginatedAssignmentResponse;
          setAssignments(paginated.data);
          setPagination(paginated.pagination);
        } else {
          const items = Array.isArray(response) ? response : [];
          setAssignments(items);
          setPagination({ total: items.length, totalPages: 1, hasNext: false, hasPrev: false });
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

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSkill, searchQuery]);

  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments;
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

  const clearSearch = () => setSearchQuery("");

  if (loading && assignments.length === 0) return <LoadingScreen />;

  const totalPages = pagination?.totalPages || 1;
  const totalItems = pagination?.total || filteredAssignments.length;
  const showingFrom = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const showingTo = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  const activeSkillLabel = SKILL_LABELS[activeSkill];

  return (
    <div className="px-6 py-10">

      {/* ── Header ── */}
      <div className="mb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          {/* Left: text */}
          <div className="flex flex-col gap-4">
            <div
              className="self-start inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase"
              style={{
                backgroundColor: "var(--color-surface-subtle)",
                color: "var(--color-brand)",
                border: "1px solid var(--color-border-default)",
                letterSpacing: "0.08em",
                fontFamily: "var(--font-body)",
              }}
            >
              Luyện tập tạo nên sự hoàn hảo
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(32px, 4vw, 48px)",
                  color: "var(--color-text-primary)",
                  lineHeight: 1,
                }}
              >
                Bài tập
              </h1>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/assignment/submissions">Bài nộp</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/assignment/create">Tạo bài</Link>
                </Button>
              </div>
            </div>

            <p
              className="text-sm leading-relaxed max-w-md"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Khám phá và luyện tập với bộ sưu tập bài tập IELTS được tuyển chọn qua tất cả các kỹ năng.
            </p>
          </div>

          {/* Right: cat image — switches with active tab */}
          <div
            className="relative h-56 lg:h-64 rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--color-surface-subtle)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <Image
              key={activeSkill}
              src={SKILL_IMAGES[activeSkill]}
              alt={activeSkillLabel}
              fill
              className="object-contain p-6 transition-opacity duration-300"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "var(--color-text-muted)" }}
          />
          <Input
            type="text"
            placeholder="Tìm kiếm bài tập..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 text-sm"
            style={{ borderColor: "var(--color-border-default)" }}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              aria-label="Xóa tìm kiếm"
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Tìm thấy {filteredAssignments.length} bài tập trong {activeSkillLabel}
          </p>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs
        value={activeSkill}
        onValueChange={(value) => setActiveSkill(value as Skill)}
        className="w-full"
      >
        <TabsList
          className="grid w-full grid-cols-4 mb-8 p-1 rounded-2xl h-auto"
          style={{
            backgroundColor: "var(--color-surface-muted)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          {SKILLS.map((skill) => {
            const isActive = activeSkill === skill.value;
            return (
              <TabsTrigger
                key={skill.value}
                value={skill.value}
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150"
                style={{
                  color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)",
                  backgroundColor: isActive ? "var(--color-surface-card)" : "transparent",
                  boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Image
                  src={skill.image}
                  alt=""
                  width={20}
                  height={20}
                  className="object-contain"
                />
                <span className="hidden sm:inline">{skill.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {SKILLS.map((skill) => (
          <TabsContent key={skill.value} value={skill.value} className="mt-0">

            {/* Loading */}
            {loading ? (
              <div className="py-24 flex flex-col items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: "var(--color-border-default)",
                    borderTopColor: "var(--color-brand)",
                  }}
                />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Đang tải bài tập...
                </p>
              </div>

            ) : filteredAssignments.length === 0 ? (
              /* Empty state */
              <div
                className="rounded-2xl p-16 flex flex-col items-center gap-5 text-center"
                style={{
                  border: "1px dashed var(--color-border-default)",
                  backgroundColor: "var(--color-surface-subtle)",
                }}
              >
                <div className="relative w-16 h-16 opacity-40">
                  <Image
                    src={SKILL_IMAGES[activeSkill]}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="64px"
                  />
                </div>
                <div>
                  <h3
                    className="mb-1"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "20px",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {searchQuery ? "Không tìm thấy" : "Chưa có bài tập"}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {searchQuery
                      ? "Thử từ khóa khác hoặc xóa tìm kiếm."
                      : `Chưa có bài tập ${skill.label.toLowerCase()} nào. Hãy quay lại sau!`}
                  </p>
                </div>
                {searchQuery && (
                  <Button variant="outline" size="sm" onClick={clearSearch}>
                    Xóa tìm kiếm
                  </Button>
                )}
              </div>

            ) : (
              <>
                {/* Card grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                  {filteredAssignments.map((item, index) => (
                    <div
                      key={item.id}
                      className="animate-slide-up"
                      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
                    >
                      <AssignmentCard item={item} />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {!searchQuery && totalPages > 1 && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!pagination?.hasPrev || currentPage === 1}
                        className="disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Trước
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            const isCurrent = currentPage === page;
                            return (
                              <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className="min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors duration-150"
                                style={{
                                  backgroundColor: isCurrent ? "var(--color-brand)" : "transparent",
                                  color: isCurrent ? "#ffffff" : "var(--color-text-secondary)",
                                  border: isCurrent ? "none" : "1px solid var(--color-border-subtle)",
                                }}
                              >
                                {page}
                              </button>
                            );
                          }
                          if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <span key={page} className="px-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                                …
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
                        className="disabled:opacity-40"
                      >
                        Sau
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Hiển thị {showingFrom}–{showingTo} trong {totalItems} bài tập
                    </p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
