"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { joinClass, validateInviteCode } from "@/services/class.service";
import { toast } from "sonner";
import { LogIn, Key, AlertTriangle, Clock, Calendar, X } from "lucide-react";
import { DialogClose } from "@/components/ui/dialog";
import { ClassData } from "@/types/class";

interface JoinClassModalProps {
  open: boolean;
  onClose: () => void;
  onJoined?: () => void;
  enrolledClasses?: ClassData[];
}

const DAY_LABELS: Record<string, string> = {
  Monday: "T2", Tuesday: "T3", Wednesday: "T4", Thursday: "T5",
  Friday: "T6", Saturday: "T7", Sunday: "CN",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function hasScheduleConflict(a: ClassData, b: ClassData): boolean {
  if (!a.schedule || !b.schedule) return false;
  const daysOverlap = a.schedule.days.some((d) => b.schedule!.days.includes(d));
  if (!daysOverlap) return false;
  const aStart = timeToMinutes(a.schedule.time);
  const aEnd = aStart + (a.schedule.duration || 60);
  const bStart = timeToMinutes(b.schedule.time);
  const bEnd = bStart + (b.schedule.duration || 60);
  return !(aEnd <= bStart || bEnd <= aStart);
}

export default function JoinClassModal({
  open,
  onClose,
  onJoined,
  enrolledClasses = [],
}: JoinClassModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ClassData[]>([]);
  const [targetClass, setTargetClass] = useState<ClassData | null>(null);
  const [step, setStep] = useState<"input" | "confirm">("input");

  const handleClose = () => {
    setInviteCode("");
    setConflicts([]);
    setTargetClass(null);
    setStep("input");
    onClose();
  };

  const handleCheck = async () => {
    if (!inviteCode.trim()) {
      toast.error("Vui lòng nhập mã mời.");
      return;
    }
    setLoading(true);
    const result = await validateInviteCode(inviteCode.trim());
    setLoading(false);

    if (!result.valid || !result.class) {
      toast.error("Mã mời không hợp lệ hoặc lớp học không tồn tại.");
      return;
    }

    const found = enrolledClasses
      .filter((cls) => cls.id !== result.class!.id)
      .filter((cls) => hasScheduleConflict(result.class!, cls));

    setTargetClass(result.class);

    if (found.length > 0) {
      setConflicts(found);
      setStep("confirm");
    } else {
      await doJoin();
    }
  };

  const doJoin = async () => {
    setLoading(true);
    const res = await joinClass(inviteCode.trim());
    setLoading(false);

    if (res.status) {
      toast.success(res.message);
      onJoined?.();
      handleClose();
    } else {
      toast.error(res.message || "Không thể tham gia lớp học");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step === "input") handleCheck();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[92vw] !sm:max-w-3xl bg-gradient-to-br from-gray-50 via-white to-orange-50 [&>button:last-child]:hidden overflow-hidden">
        <DialogClose asChild>
          <button className="absolute right-4 top-4 rounded-full p-2 text-gray-500 hover:text-white hover:bg-orange-500 transition-colors z-10 shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </DialogClose>
        <DialogHeader className="space-y-3 pb-4 border-b border-orange-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-900 via-orange-700 to-orange-500 flex items-center justify-center shadow-lg">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-orange-900 to-orange-500 bg-clip-text text-transparent">
                Tham gia lớp học
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                {step === "input" ? "Nhập mã mời để tham gia" : "Kiểm tra xung đột lịch học"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="py-5">
          {step === "input" && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-orange-100 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Key className="w-4 h-4 text-orange-500" />
                  Mã mời
                </Label>
                <Input
                  id="invite-code"
                  placeholder="Nhập mã mời của bạn (ví dụ: IELTS2025)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border-gray-200 focus:border-blue-400 focus:ring-blue-400 text-gray-900 font-mono text-base h-12"
                  autoFocus
                />
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  💡 Lấy mã từ giáo viên hoặc quản trị viên lớp học
                </p>
              </div>
            </div>
          )}

          {step === "confirm" && targetClass && (
            <div className="space-y-4">
              {/* Target class info */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Lớp học sẽ tham gia</p>
                <p className="font-semibold text-gray-900">{targetClass.name}</p>
                {targetClass.schedule && (
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {targetClass.schedule.time} ({targetClass.schedule.duration} phút)
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {targetClass.schedule.days.map((d) => DAY_LABELS[d] || d).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Conflict warning */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">
                      Phát hiện xung đột lịch học
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Lớp này có lịch trùng với {conflicts.length} lớp bạn đã ghi danh.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {conflicts.map((cls) => (
                    <div
                      key={cls.id}
                      className="bg-white rounded-lg p-3 border border-amber-100"
                    >
                      <p className="font-medium text-gray-900 text-sm">{cls.name}</p>
                      {cls.schedule && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {cls.schedule.time} ({cls.schedule.duration} phút)
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {cls.schedule.days.map((d) => DAY_LABELS[d] || d).join(", ")}
                          </span>
                        </div>
                      )}
                      {/* Highlight conflicting days */}
                      {targetClass.schedule && cls.schedule && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {targetClass.schedule.days
                            .filter((d) => cls.schedule!.days.includes(d))
                            .map((d) => (
                              <span
                                key={d}
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700"
                              >
                                {DAY_LABELS[d] || d} trùng lịch
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-xs text-amber-700 mt-3">
                  Bạn vẫn có thể tham gia nếu muốn.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4 border-t border-orange-100 bg-gradient-to-r from-white via-orange-50 to-amber-50">
          {step === "input" && (
            <>
              <Button type="button" onClick={handleClose} disabled={loading} className="border-gray-300 hover:bg-gray-50">
                Hủy
              </Button>
              <Button
                type="button"
                onClick={handleCheck}
                disabled={loading || !inviteCode.trim()}
                className="min-w-40 bg-gradient-to-r from-gray-900 via-orange-700 to-orange-500 text-white shadow-lg transition-colors duration-700 ease-in-out hover:from-gray-900 hover:via-orange-600 hover:to-orange-400 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-200 disabled:via-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:shadow-none"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang kiểm tra...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Tham gia lớp học
                  </span>
                )}
              </Button>
            </>
          )}

          {step === "confirm" && (
            <>
              <Button
                type="button"
                onClick={() => setStep("input")}
                disabled={loading}
                className="border-gray-300 hover:bg-gray-50"
              >
                Quay lại
              </Button>
              <Button
                type="button"
                onClick={doJoin}
                disabled={loading}
                className="min-w-48 bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang tham gia...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Vẫn tham gia
                  </span>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
