"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSession } from "@/services/session.service";
import { SessionData, UpdateSessionPayload } from "@/types/session";

interface UpdateSessionModalProps {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  session: SessionData | null;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Đã xảy ra lỗi";

export default function UpdateSessionModal({
  open,
  onClose,
  onUpdated,
  session,
}: UpdateSessionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    topic: "",
    start_time: "",
    end_time: "",
  });

  useEffect(() => {
    if (session) {
      // Convert UTC time to local time for datetime-local input
      const formatDateTimeLocal = (utcDateString: string) => {
        const date = new Date(utcDateString);
        // Get local date and time
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setFormData({
        topic: session.metadata?.topic || "",
        start_time: formatDateTimeLocal(session.start_time),
        end_time: session.end_time ? formatDateTimeLocal(session.end_time) : "",
      });
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setError("");
    setLoading(true);

    try {
      const startTime = new Date(formData.start_time).toISOString();
      const endTime = formData.end_time
        ? new Date(formData.end_time).toISOString()
        : undefined;

      const payload: UpdateSessionPayload = {
        start_time: startTime,
        end_time: endTime,
        metadata: {
          ...session.metadata,
          topic: formData.topic || "Buổi học chưa có tên",
        },
      };

      const res = await updateSession(session.id, payload);

      if (res.statusCode === 200) {
        onUpdated();
        onClose();
      } else {
        setError(res.message || "Không thể cập nhật buổi học");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    onClose();
  };

  if (!session) return null;

  // Get current datetime in local timezone
  const getLocalDateTimeString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  const minDateTime = getLocalDateTimeString();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cập nhật buổi học</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm text-gray-600">Lớp học</Label>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {session.class.name}
              </p>
            </div>

            <div>
              <Label htmlFor="topic">Chủ đề *</Label>
              <Input
                id="topic"
                value={formData.topic}
                onChange={(e) =>
                  setFormData({ ...formData, topic: e.target.value })
                }
                placeholder="ví dụ: IELTS Writing Task 1"
                required
              />
            </div>

            <div>
              <Label htmlFor="start_time">Giờ bắt đầu (Giờ địa phương của bạn) *</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                min={minDateTime}
                required
              />
            </div>

            <div>
              <Label htmlFor="end_time">Giờ kết thúc (Giờ địa phương của bạn) - Tùy chọn</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                min={formData.start_time || minDateTime}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang cập nhật..." : "Cập nhật buổi học"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

