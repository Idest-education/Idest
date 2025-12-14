"use client";

import { useEffect, useMemo, useState } from "react";
import { ClassData, ClassResponse } from "@/types/class";
import { getUserClasses, getAllVisibleClasses } from "@/services/class.service";
import { createClassCheckoutSession } from "@/services/stripe.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Users,
  Crown,
  BookOpen,
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function formatVnd(price?: number | null, currency?: string) {
  if (price == null) return "Miễn phí";
  const formatter = new Intl.NumberFormat("vi-VN");
  const cur = (currency || "VND").toUpperCase();
  return `${formatter.format(price)} ${cur}`;
}

export default function ClassShowcaseClient() {
  const [userClasses, setUserClasses] = useState<ClassResponse>({
    created: [],
    teaching: [],
    enrolled: [],
  });
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const enrolledIds = useMemo(() => {
    const set = new Set<string>();
    userClasses.created.forEach((c) => set.add(c.id));
    userClasses.teaching.forEach((c) => set.add(c.id));
    userClasses.enrolled.forEach((c) => set.add(c.id));
    return set;
  }, [userClasses]);

  // Filter classes based on search query
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) {
      return allClasses;
    }
    const query = searchQuery.toLowerCase();
    return allClasses.filter(
      (cls) =>
        cls.name.toLowerCase().includes(query) ||
        cls.description?.toLowerCase().includes(query) ||
        cls.creator?.full_name?.toLowerCase().includes(query)
    );
  }, [allClasses, searchQuery]);

  // Paginate filtered classes
  const paginatedClasses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredClasses.slice(startIndex, endIndex);
  }, [filteredClasses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, all] = await Promise.all([
          getUserClasses(),
          getAllVisibleClasses(),
        ]);
        setUserClasses(
          userRes?.data || { created: [], teaching: [], enrolled: [] },
        );
        setAllClasses(all || []);
      } catch (e) {
        console.error("Failed to load classes for showcase", e);
        setError("Không thể tải lớp học. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);


  const openModal = (cls: ClassData) => {
    setSelectedId(cls.id);
    setModalOpen(true);
    setSelectedClass(cls);
    setError(null);
    setSuccessMessage(null);
  };

  const refreshUserClasses = async () => {
    try {
      const userRes = await getUserClasses();
      setUserClasses(
        userRes?.data || { created: [], teaching: [], enrolled: [] },
      );
    } catch (e) {
      console.error("Failed to refresh user classes", e);
    }
  };

  const handlePurchase = async () => {
    if (!selectedId) return;
    setPurchaseLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const session = await createClassCheckoutSession(selectedId);

      // Log the response for debugging (remove in production if needed)
      console.log("Checkout session response:", session);

      // Handle free classes
      if (session.isFree) {
        // Free class - already enrolled by backend
        await refreshUserClasses();
        setSuccessMessage("Bạn đã được ghi danh vào lớp học này.");
        setPurchaseLoading(false);
        return;
      }

      // Handle already owned classes
      if (session.alreadyOwned) {
        await refreshUserClasses();
        setSuccessMessage("Bạn đã sở hữu lớp học này.");
        setPurchaseLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (session.url) {
        window.location.href = session.url;
        // Note: setPurchaseLoading won't be called here since we're redirecting
      } else {
        // Log the full response for debugging
        console.error("Checkout session response missing URL:", session);
        throw new Error(
          "Không nhận được URL thanh toán từ máy chủ. Phiên thanh toán có thể chưa được tạo đúng cách. Vui lòng thử lại hoặc liên hệ hỗ trợ."
        );
      }
    } catch (e) {
      console.error("Purchase failed", e);
      const errorMessage = e instanceof Error ? e.message : "Mua hàng thất bại. Vui lòng thử lại.";
      setError(errorMessage);
      setPurchaseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
          <p className="text-gray-600 text-sm">Đang tải lớp học cho bạn...</p>
        </div>
      </div>
    );
  }

  const hasClasses = allClasses.length > 0;

  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      {/* Global success/error message banner */}
      {successMessage && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            ×
          </button>
        </div>
      )}
      {error && !successMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}
      {/* Header strip */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6 animate-in fade-in slide-in-from-top-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 via-orange-100 to-orange-100 text-xs font-medium text-gray-800 shadow-sm mb-4 hover:shadow-md transition-shadow duration-300">
            <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
            Các lớp tiếng Anh được tuyển chọn dành cho bạn
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-3 bg-gradient-to-r from-gray-900 via-orange-900 to-orange-800 bg-clip-text text-transparent">
            Khám phá{" "}
            <span className="bg-gradient-to-r from-orange-500 via-orange-500 to-orange-600 bg-clip-text text-transparent">
              lớp học đột phá
            </span>{" "}
            tiếp theo của bạn
          </h2>
          <p className="text-gray-600 max-w-2xl">
            Các lớp IELTS và tiếng Anh được tuyển chọn kỹ lưỡng với buổi học trực tiếp, giáo viên
            chuyên nghiệp và thực hành được hỗ trợ bởi AI. Ghi danh vào một lớp học phù hợp
            với mục tiêu và trình độ của bạn.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs md:text-sm hover:scale-105 transition-transform duration-300 shadow-lg hover:shadow-xl">
            <Crown className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Trải nghiệm cao cấp</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs md:text-sm border border-emerald-100 hover:scale-105 hover:bg-emerald-100 transition-all duration-300 shadow-sm hover:shadow-md">
            <ShieldCheck className="w-4 h-4" />
            <span>Thanh toán an toàn và bảo mật</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 animate-in fade-in slide-in-from-top-4">
        <div className="relative max-w-md group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-orange-500 transition-colors duration-300" />
          <Input
            type="text"
            placeholder="Tìm kiếm lớp học theo tên, mô tả hoặc giáo viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full transition-all duration-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-gray-400 shadow-sm hover:shadow-md"
          />
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600 animate-in fade-in slide-in-from-top-2">
            Tìm thấy {filteredClasses.length} lớp học
          </p>
        )}
      </div>

      {!hasClasses ? (
        <div className="border border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gradient-to-br from-white via-gray-50 to-gray-100">
          <div className="max-w-md mx-auto space-y-4">
            <BookOpen className="w-10 h-10 mx-auto text-gray-400" />
            <h3 className="text-2xl font-semibold text-gray-900">
              Chưa có lớp học nào
            </h3>
            <p className="text-gray-600">
              Hãy quay lại sau để xem các lớp học mới, hoặc yêu cầu giáo viên của bạn mời bạn
              vào một lớp học riêng.
            </p>
          </div>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gradient-to-br from-white via-gray-50 to-gray-100">
          <div className="max-w-md mx-auto space-y-4">
            <Search className="w-10 h-10 mx-auto text-gray-400" />
            <h3 className="text-2xl font-semibold text-gray-900">
              Không tìm thấy lớp học
            </h3>
            <p className="text-gray-600">
              Thử điều chỉnh truy vấn tìm kiếm của bạn để tìm lớp học.
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
      ) : (
        <>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {paginatedClasses.map((cls, index) => {
            const isEnrolled = enrolledIds.has(cls.id);
            const isGroup = (cls as any).is_group ?? true;
            return (
              <Card
                key={cls.id}
                className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-900/90 text-white cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                onClick={() => openModal(cls)}
              >
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 opacity-30 group-hover:opacity-40 transition-opacity duration-300 bg-[radial-gradient(circle_at_top,_#6366f1,_transparent_55%),_radial-gradient(circle_at_bottom,_#ec4899,_transparent_55%)]" />
                
                {/* Shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-60 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-all duration-700" />
                
                {/* Glowing background effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300 -z-10" />
                
                <div className="relative p-6 flex flex-col h-full z-10">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-orange-500/20 group-hover:bg-orange-500/30 group-hover:scale-105 transition-all duration-300">
                          <BookOpen className="w-4 h-4 text-orange-300 group-hover:text-orange-200" />
                        </div>
                        <Badge
                          variant={isEnrolled ? "secondary" : "outline"}
                          className={
                            isEnrolled
                              ? "bg-emerald-400 text-emerald-900 border-transparent group-hover:scale-105 transition-transform duration-300"
                              : "border-gray-500 text-gray-100 group-hover:border-white/40 group-hover:bg-white/5 transition-all duration-300"
                          }
                        >
                          {isEnrolled ? "Đã ghi danh" : isGroup ? "Lớp nhóm" : "1:1"}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl font-bold leading-tight group-hover:scale-[1.02] transition-transform duration-300">
                        {cls.name}
                      </CardTitle>
                      <p className="text-sm text-gray-300 line-clamp-2 group-hover:text-gray-200 transition-colors duration-300">
                        {cls.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/10 group-hover:border-white/30 transition-colors duration-300">
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                        Giá từ
                      </div>
                      <div className="text-xl font-bold group-hover:scale-105 transition-transform duration-300">
                        {formatVnd(cls.price, cls.currency)}
                      </div>
                      <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                        {cls._count?.members ?? 0} người học
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/30 text-white hover:bg-white hover:text-gray-900 bg-white/10 backdrop-blur-sm group-hover:scale-105 group-hover:shadow-md transition-all duration-300"
                    >
                      {isEnrolled ? (
                        <>
                          Đi đến lớp
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform duration-300" />
                        </>
                      ) : (
                        <>
                          Xem chi tiết
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform duration-300" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
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
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sau
                <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>
          )}

          {/* Page Info */}
          {totalPages > 1 && (
            <div className="mt-4 text-center text-sm text-gray-600 animate-in fade-in">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} đến{" "}
              {Math.min(currentPage * itemsPerPage, filteredClasses.length)} trong{" "}
              {filteredClasses.length} lớp học
            </div>
          )}
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-white text-gray-900 max-h-[80vh] overflow-y-auto sm:max-w-5xl">
          {selectedClass ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span>{selectedClass.name}</span>
                  <Badge className="bg-gray-900 text-white border-transparent">
                    {formatVnd(selectedClass.price, selectedClass.currency)}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Giảng dạy bởi {selectedClass.creator.full_name} •{" "}
                  {selectedClass._count.members} người học đã ghi danh
                </DialogDescription>
              </DialogHeader>

              <div className="grid md:grid-cols-[1.7fr,1.3fr] gap-8 mt-4">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Về lớp học này</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {selectedClass.description}
                  </p>

                  <div className="mt-6 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Điểm nổi bật
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-orange-500 mt-0.5" />
                        <span>
                          Các buổi học tương tác trực tiếp được thiết kế để tăng cường sự tự tin
                          của bạn trong các tình huống thi thực tế.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users className="w-4 h-4 text-pink-500 mt-0.5" />
                        <span>
                          Thực hành hợp tác với bạn bè cùng với hướng dẫn 1:1 từ
                          các giảng viên giàu kinh nghiệm.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-500 mt-0.5" />
                        <span>
                          Bài tập về nhà, bài tập và phản hồi được hỗ trợ bởi AI để cải thiện
                          kỹ năng của bạn giữa các buổi học.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 p-5 bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-900 text-white shadow-lg">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-gray-300">
                      Đầu tư
                    </div>
                    <div className="text-3xl font-bold">
                      {formatVnd(selectedClass.price, selectedClass.currency)}
                    </div>
                    <p className="text-xs text-gray-300">
                      Mua một lần để truy cập đầy đủ lớp học này.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Button
                      className="w-full bg-emerald-400 hover:bg-emerald-300 text-gray-900 font-semibold flex items-center justify-center gap-2"
                      onClick={handlePurchase}
                      disabled={purchaseLoading}
                    >
                      {purchaseLoading ? (
                        <>
                          Đang xử lý...
                          <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                        </>
                      ) : (
                        <>
                          Mua và ghi danh
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                    <p className="text-[11px] text-gray-300 text-center">
                      Thanh toán an toàn được hỗ trợ bởi Stripe. Truy cập được cấp
                      ngay sau khi mua.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-200 mt-2">
                    <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                      <div className="font-semibold mb-1">Buổi học trực tiếp</div>
                      <div>{selectedClass._count.sessions}+ được bao gồm</div>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                      <div className="font-semibold mb-1">Trình độ</div>
                      <div>Trung cấp – Nâng cao</div>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-3 text-xs text-red-200 bg-red-500/20 border border-red-500/40 rounded-md px-3 py-2">
                      {error}
                    </div>
                  )}
                  {successMessage && (
                    <div className="mt-3 text-xs text-emerald-200 bg-emerald-500/20 border border-emerald-500/40 rounded-md px-3 py-2">
                      {successMessage}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Đang tải lớp học…</DialogTitle>
                <DialogDescription>
                  Đang lấy chi tiết lớp học, vui lòng đợi.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                  <p className="text-gray-600 text-sm">
                    Đang tải chi tiết lớp học...
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}


