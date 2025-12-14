"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingScreen from "@/components/loading-screen";
import { getMySubmissions } from "@/services/assignment.service";
import type { PaginationDto, Skill, SubmissionListItem } from "@/types/assignment";
import { ChevronLeft, ChevronRight, BookOpen, Calendar, ArrowRight, Trophy } from "lucide-react";

type SkillFilter = "all" | Skill;

const ITEMS_PER_PAGE = 10;

export default function MySubmissionsPage() {
  const [skill, setSkill] = useState<SkillFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [queuedDialogOpen, setQueuedDialogOpen] = useState(false);
  const [pagination, setPagination] = useState<{
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null>(null);

  useEffect(() => {
    // Show "queued for grading" popup once after redirect from submit
    try {
      const flag = sessionStorage.getItem("assignment_grading_queued");
      if (flag === "1") {
        sessionStorage.removeItem("assignment_grading_queued");
        setQueuedDialogOpen(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const paginationDto: PaginationDto = { page: currentPage, limit: ITEMS_PER_PAGE };
        const res = await getMySubmissions({
          ...paginationDto,
          skill: skill === "all" ? undefined : skill,
        });
        setItems(res.data ?? []);
        setPagination(res.pagination ?? null);
      } catch (e: unknown) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Không thể tải bài nộp");
        setItems([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentPage, skill]);

  useEffect(() => {
    setCurrentPage(1);
  }, [skill]);

  const totalPages = pagination?.totalPages || 1;

  // Group submissions by assignment title and count occurrences in chronological order
  const enrichedItems = useMemo(() => {
    // Group by assignment title
    const titleGroups = new Map<string, SubmissionListItem[]>();
    items.forEach((item) => {
      const title = item.assignmentTitle ?? `Assignment ${item.assignmentId}`;
      if (!titleGroups.has(title)) {
        titleGroups.set(title, []);
      }
      titleGroups.get(title)!.push(item);
    });

    // Sort each group by creation date (newest first) and assign try numbers
    const itemsWithTry: Array<SubmissionListItem & { displayTitle: string }> = [];
    
    titleGroups.forEach((groupItems, title) => {
      // Sort by creation date (newest first)
      const sorted = [...groupItems].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Assign try numbers (1st, 2nd, 3rd, etc.) - newest gets highest number
      sorted.forEach((item, index) => {
        const tryNumber = sorted.length - index; // Reverse order: newest = highest number
        const displayTitle = sorted.length > 1 
          ? `${title} (lần thứ ${tryNumber})`
          : title;
        
        itemsWithTry.push({
          ...item,
          displayTitle,
        });
      });
    });

    // Sort all items by creation date (newest first) to maintain overall order
    return itemsWithTry.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [items]);

  const viewHref = (it: SubmissionListItem) =>
    `/assignment/${it.skill}/${it.assignmentId}/result/${it.submissionId}`;

  if (loading && items.length === 0) return <LoadingScreen />;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <Dialog open={queuedDialogOpen} onOpenChange={setQueuedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đang chấm điểm</DialogTitle>
            <DialogDescription>
              Bài tập của bạn đang được hệ thống thông minh chấm điểm, bạn quay lại sau nhé
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setQueuedDialogOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2 bg-gradient-to-r from-gray-900 via-orange-900 to-orange-800 bg-clip-text text-transparent">
            Bài nộp của tôi
          </h1>
          <p className="text-gray-600">Xem và quản lý tất cả các bài nộp trước đây của bạn.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/assignment">Quay lại</Link>
          </Button>
        </div>
      </div>

      <Tabs value={skill} onValueChange={(v) => setSkill(v as SkillFilter)}>
        <TabsList className="grid grid-cols-5 w-full mb-8 p-1.5 bg-gray-100/50 rounded-2xl border border-gray-200 shadow-inner">
          <TabsTrigger value="all" className="rounded-xl">Tất cả</TabsTrigger>
          <TabsTrigger value="reading" className="rounded-xl">Đọc</TabsTrigger>
          <TabsTrigger value="listening" className="rounded-xl">Nghe</TabsTrigger>
          <TabsTrigger value="writing" className="rounded-xl">Viết</TabsTrigger>
          <TabsTrigger value="speaking" className="rounded-xl">Nói</TabsTrigger>
        </TabsList>

        <TabsContent value={skill} className="mt-0">
          {error && (
            <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-24 flex justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                <p className="text-gray-600 text-sm">Đang tải bài nộp...</p>
              </div>
            </div>
          ) : enrichedItems.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gradient-to-br from-white via-gray-50 to-gray-100">
              <div className="max-w-md mx-auto space-y-4">
                <BookOpen className="w-10 h-10 mx-auto text-gray-400" />
                <h3 className="text-2xl font-semibold text-gray-900">Chưa có bài nộp nào</h3>
                <p className="text-gray-600">
                  Bạn chưa nộp bài tập nào. Bắt đầu luyện tập để xem bài nộp của bạn ở đây!
                </p>
                <Button asChild className="mt-4">
                  <Link href="/assignment">Duyệt bài tập</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {enrichedItems.map((it, index) => {
                  const skillConfig = getSkillConfig(it.skill);
                  return (
                    <div
                      key={`${it.skill}:${it.submissionId}`}
                      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:border-transparent animate-in fade-in slide-in-from-bottom-4"
                      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                    >
                      {/* Dark gradient overlay on hover */}
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-gradient-to-br ${skillConfig.darkGradient} z-10`} />
                      
                      {/* Animated background pattern */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
                      </div>
                      
                      {/* Content */}
                      <div className="relative p-6 flex flex-col h-full z-20">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`p-2.5 rounded-lg ${skillConfig.bgColor} ${skillConfig.textColor} group-hover:bg-white/20 group-hover:text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <Badge 
                                className={`${skillConfig.badgeClass} border-0 text-xs font-medium capitalize group-hover:bg-white/20 group-hover:text-white group-hover:backdrop-blur-sm transition-all duration-500`}
                              >
                                {getSkillLabel(it.skill)}
                              </Badge>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-white transition-all duration-500 line-clamp-2 group-hover:scale-[1.02]">
                              {it.displayTitle}
                            </h3>
                          </div>
                        </div>

                        {/* Score Display */}
                        {it.status === "pending" ? (
                          <div className="mb-4 flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${skillConfig.bgColor} ${skillConfig.textColor} group-hover:bg-white/20 group-hover:text-white transition-all duration-500`}>
                              <Trophy className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm text-gray-500 group-hover:text-white/80 transition-all duration-500">
                                Trạng thái
                              </div>
                              <div className="text-lg font-bold text-gray-900 group-hover:text-white transition-all duration-500">
                                Đang chấm điểm
                              </div>
                            </div>
                          </div>
                        ) : typeof it.score === "number" ? (
                          <div className="mb-4 flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${skillConfig.bgColor} ${skillConfig.textColor} group-hover:bg-white/20 group-hover:text-white transition-all duration-500`}>
                              <Trophy className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm text-gray-500 group-hover:text-white/80 transition-all duration-500">Điểm số</div>
                              <div className="text-2xl font-bold text-gray-900 group-hover:text-white transition-all duration-500">
                                {it.score}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200 group-hover:border-white/20 transition-all duration-500 mt-auto">
                          <div className="flex items-center gap-2 text-xs text-gray-500 group-hover:text-white/80 transition-all duration-500 group-hover:scale-105">
                            <Calendar className="w-3 h-3 group-hover:rotate-12 transition-transform duration-500" />
                            <span>{new Date(it.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 group-hover:border-white/20 transition-all duration-500">
                          {it.status === "pending" ? (
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="flex-1 group-hover:bg-white/20 group-hover:text-white group-hover:backdrop-blur-sm text-gray-700 hover:text-gray-900 transition-all duration-500"
                            >
                              <Link href={viewHref(it)}>
                                Xem bài nộp
                                <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-2 transition-transform duration-500" />
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="flex-1 group-hover:bg-white/20 group-hover:text-white group-hover:backdrop-blur-sm text-gray-700 hover:text-gray-900 transition-all duration-500"
                            >
                              <Link href={viewHref(it)}>
                                Xem kết quả
                                <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-2 transition-transform duration-500" />
                              </Link>
                            </Button>
                          )}
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30 transition-all duration-500"
                          >
                            <Link href={`/assignment/${it.skill}/${it.assignmentId}`}>
                              Mở
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={!pagination?.hasPrev || currentPage === 1}
                    className="transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[40px] transition-all duration-300 hover:scale-110 ${
                              currentPage === page
                                ? "shadow-lg ring-2 ring-orange-500/50"
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
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={!pagination?.hasNext || currentPage === totalPages}
                    className="transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sau
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getSkillLabel(skill: string): string {
  switch (skill) {
    case "reading":
      return "Đọc";
    case "listening":
      return "Nghe";
    case "writing":
      return "Viết";
    case "speaking":
      return "Nói";
    default:
      return skill;
  }
}

function getSkillConfig(skill: string) {
  switch (skill) {
    case "reading":
      return {
        darkGradient: "from-gray-900 via-blue-900 to-indigo-900",
        bgColor: "bg-blue-100",
        textColor: "text-blue-600",
        badgeClass: "bg-blue-500 text-white",
      };
    case "listening":
      return {
        darkGradient: "from-gray-900 via-emerald-900 to-teal-900",
        bgColor: "bg-emerald-100",
        textColor: "text-emerald-600",
        badgeClass: "bg-emerald-500 text-white",
      };
    case "writing":
      return {
        darkGradient: "from-gray-900 via-amber-900 to-orange-900",
        bgColor: "bg-amber-100",
        textColor: "text-amber-600",
        badgeClass: "bg-amber-500 text-white",
      };
    case "speaking":
      return {
        darkGradient: "from-gray-900 via-red-900 to-rose-900",
        bgColor: "bg-red-100",
        textColor: "text-red-600",
        badgeClass: "bg-red-500 text-white",
      };
    default:
      return {
        darkGradient: "from-gray-900 to-gray-800",
        bgColor: "bg-gray-100",
        textColor: "text-gray-600",
        badgeClass: "bg-gray-500 text-white",
      };
  }
}


