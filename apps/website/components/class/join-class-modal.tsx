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
import { joinClass } from "@/services/class.service";
import { toast } from "sonner";
import { LogIn, Key } from "lucide-react";
import { DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface JoinClassModalProps {
  open: boolean;
  onClose: () => void;
  onJoined?: () => void;
}

export default function JoinClassModal({ open, onClose, onJoined }: JoinClassModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      toast.error("Vui lòng nhập mã mời.");
      return;
    }
    setLoading(true);
    const res = await joinClass(inviteCode.trim());
    setLoading(false);

    if (res.status) {
      toast.success(res.message);
      onJoined?.();
      onClose();
      setInviteCode("");
    } else {
      toast.error(res.message || "Không thể tham gia lớp học");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
                Nhập mã mời để tham gia
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="py-5">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                className="border-gray-200 focus:border-blue-400 focus:ring-blue-400 text-gray-900 font-mono text-base h-12"
                autoFocus
              />
              <p className="text-xs text-gray-500 flex items-center gap-1">
                💡 Lấy mã từ giáo viên hoặc quản trị viên lớp học
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 pt-4 border-t border-orange-100 bg-gradient-to-r from-white via-orange-50 to-amber-50">
          <Button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="border-gray-300 hover:bg-gray-50"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleJoin}
            disabled={loading || !inviteCode.trim()}
            className="min-w-40 bg-gradient-to-r from-gray-900 via-orange-700 to-orange-500 text-white shadow-lg transition-colors duration-700 ease-in-out hover:from-gray-900 hover:via-orange-600 hover:to-orange-400 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-200 disabled:via-gray-200 disabled:to-gray-200 disabled:text-gray-500 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Đang tham gia...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Tham gia lớp học
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}