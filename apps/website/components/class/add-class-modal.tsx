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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { createClass } from "@/services/class.service";
import type { CreateClassPayload, ScheduleData } from "@/types/class";
import { BookOpen, Users, Clock, Calendar, Globe } from "lucide-react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";

export default function AddClassModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<CreateClassPayload>({
    name: "",
    description: "",
    is_group: true,
    invite_code: "",
    schedule: {
      days: [],
      time: "",
      duration: 90,
      timezone: "UTC",
      recurring: true,
    },
  });

  const weekdays = [
    { key: "monday", label: "Mon" },
    { key: "tuesday", label: "Tue" },
    { key: "wednesday", label: "Wed" },
    { key: "thursday", label: "Thu" },
    { key: "friday", label: "Fri" },
    { key: "saturday", label: "Sat" },
    { key: "sunday", label: "Sun" },
  ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleScheduleChange = <K extends keyof ScheduleData>(
    key: K,
    value: ScheduleData[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      schedule: { ...prev.schedule!, [key]: value },
    }));
  };

  const toggleDay = (day: string) => {
    setForm((prev) => {
      const currentDays = prev.schedule?.days || [];
      const updatedDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day];
      return {
        ...prev,
        schedule: { ...prev.schedule!, days: updatedDays },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);


    const payload: CreateClassPayload = {
      name: form.name,
      description: form.description || undefined,
      is_group: form.is_group,
      invite_code: form.invite_code || undefined,
      schedule:
        form.schedule?.days && form.schedule.days.length > 0
          ? form.schedule
          : undefined,
    };

    const res = await createClass(payload);
    setLoading(false);

    if (res.status) {
      toast.success(res.message || "Class created successfully 🎉", {
        description: `Your class "${form.name}" has been created.`,
      });
      onCreated?.();
      onClose();
    } else {
      toast.error(res.message || "Failed to create class");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[95vw] bg-gradient-to-br from-blue-50 via-white to-indigo-50 [&>button:last-child]:hidden">
        <DialogClose asChild>
          <button className="absolute right-4 top-4 rounded-full p-2 text-gray-600 hover:text-white hover:bg-indigo-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </DialogClose>
        <DialogHeader className="space-y-3 pb-4 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Create New Class
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Set up your English learning class
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                Basic Information
              </h3>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                  Class Name *
                </Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="e.g., IELTS Preparation - Advanced Level"
                  value={form.name}
                  onChange={handleChange}
                  className="border-gray-200 focus:border-blue-400 focus:ring-blue-400 text-gray-900"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description
                </Label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Describe the objectives, level, and what students will learn..."
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </div>
            </div>

            {/* Class Settings Section */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                Class Settings
              </h3>

              {/* Group toggle */}
              <div className="flex items-center justify-between bg-gradient-to-r from-indigo-60 to-purple-60 rounded-lg px-4 py-3 border border-blue-100">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label htmlFor="is_group" className="text-sm font-medium text-gray-800 cursor-pointer">
                      Group Class
                    </Label>
                    <p className="text-xs text-gray-500">Enable for multiple students</p>
                  </div>
                </div>
                <Switch
                  id="is_group"
                  checked={form.is_group}
                  onCheckedChange={(checked: boolean) =>
                    setForm((f) => ({ ...f, is_group: checked }))
                  }
                />
              </div>

              {/* Invite code */}
              <div className="space-y-2">
                <Label htmlFor="invite_code" className="text-sm font-medium text-gray-700">
                  Invite Code (Optional)
                </Label>
                <Input
                  id="invite_code"
                  name="invite_code"
                  placeholder="e.g., IELTS2025"
                  value={form.invite_code}
                  onChange={handleChange}
                  className="border-gray-200 focus:border-blue-400 focus:ring-blue-400 font-mono text-gray-900"
                />
                <p className="text-xs text-gray-500">
                  Students can join using this code
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Schedule Section */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              Class Schedule
            </h3>

            {/* Days */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Class Days
              </Label>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={cn(
                      "px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all duration-200",
                      form.schedule?.days.includes(day.key)
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent shadow-md scale-105"
                        : "bg-white hover:bg-blue-50 border-gray-200 text-gray-700 hover:border-blue-300"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="time" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Start Time
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={form.schedule?.time || ""}
                  onChange={(e) =>
                    handleScheduleChange("time", e.target.value)
                  }
                  className="border-gray-200 focus:border-blue-400 focus:ring-blue-400 text-gray-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-medium text-gray-700">
                  Duration (minutes)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min={30}
                  step={15}
                  value={form.schedule?.duration || 0}
                  onChange={(e) =>
                    handleScheduleChange("duration", Number(e.target.value))
                  }
                  className="border-gray-200 focus:border-blue-400 focus:ring-blue-400 text-gray-900"
                />
              </div>
            </div>

            {/* Timezone & Recurring */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  Timezone
                </Label>
                <Input
                  id="timezone"
                  placeholder="e.g., UTC, Asia/Ho_Chi_Minh"
                  value={form.schedule?.timezone || ""}
                  onChange={(e) =>
                    handleScheduleChange("timezone", e.target.value)
                  }
                  className="border-gray-200 focus:border-blue-400 focus:ring-blue-400 text-gray-900"
                />
              </div>

              <div className="flex items-end">
                <div className="w-full flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg px-4 py-2.5 border border-purple-100">
                  <Label htmlFor="recurring" className="text-sm font-medium text-gray-800 cursor-pointer">
                    Recurring
                  </Label>
                  <Switch
                    id="recurring"
                    checked={form.schedule?.recurring || false}
                    onCheckedChange={(checked: boolean) =>
                      handleScheduleChange("recurring", checked)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Footer */}
        <DialogFooter className="gap-2 pt-4 border-t border-blue-100">
          <Button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Creating...
              </span>
            ) : (
              "Create Class"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}