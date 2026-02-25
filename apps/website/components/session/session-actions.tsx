"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SessionActionsProps {
  sessionId: string;
  isActive: boolean;
  onEnd: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
}

export default function SessionActions({
  sessionId,
  isActive,
  onEnd,
  onDelete,
}: SessionActionsProps) {
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEnd = async () => {
    setLoading(true);
    try {
      await onEnd(sessionId);
      setShowEndDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(sessionId);
      setShowDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {isActive && (
          <Button
            onClick={() => setShowEndDialog(true)}
            variant="outline"
            size="sm"
          >
            Kết thúc buổi học
          </Button>
        )}
        <Button
          onClick={() => setShowDeleteDialog(true)}
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Xóa
        </Button>
      </div>

      {/* End Session Confirmation Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kết thúc buổi học</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn kết thúc buổi học này? Điều này sẽ đặt thời gian kết thúc
              là bây giờ và đánh dấu buổi học là đã hoàn thành.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEndDialog(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button onClick={handleEnd} disabled={loading}>
              {loading ? "Đang kết thúc..." : "Kết thúc buổi học"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Session Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa buổi học</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa buổi học này? Hành động này không thể
              hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? "Đang xóa..." : "Xóa buổi học"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

