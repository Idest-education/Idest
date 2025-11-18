"use client";

import { useState } from "react";
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
import { createSession } from "@/services/session.service";
import { CreateSessionPayload } from "@/types/session";

interface CreateSessionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  classId: string;
  className?: string;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "An error occurred";

export default function CreateSessionModal({
  open,
  onClose,
  onCreated,
  classId,
  className,
}: CreateSessionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    topic: "",
    start_time: "",
    end_time: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Convert local datetime to ISO string
      const startTime = new Date(formData.start_time).toISOString();
      const endTime = formData.end_time
        ? new Date(formData.end_time).toISOString()
        : undefined;

      const payload: CreateSessionPayload = {
        class_id: classId,
        start_time: startTime,
        end_time: endTime,
        is_recorded: false,
        metadata: {
          topic: formData.topic || "Untitled session",
        },
      };

      const res = await createSession(payload);

      if (res.statusCode === 200) {
        setFormData({ topic: "", start_time: "", end_time: "" });
        onCreated();
        onClose();
      } else {
        setError(res.message || "Failed to create session");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ topic: "", start_time: "", end_time: "" });
    setError("");
    onClose();
  };

  // Get current datetime in local timezone for datetime-local input
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
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {className && (
              <div>
                <Label className="text-sm text-gray-600">Class</Label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {className}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                value={formData.topic}
                onChange={(e) =>
                  setFormData({ ...formData, topic: e.target.value })
                }
                placeholder="e.g., IELTS Writing Task 1"
                required
              />
            </div>

            <div>
              <Label htmlFor="start_time">Start Time (Your Local Time) *</Label>
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
              <Label htmlFor="end_time">End Time (Your Local Time) - Optional</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                min={formData.start_time || minDateTime}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty if duration is uncertain
              </p>
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
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

