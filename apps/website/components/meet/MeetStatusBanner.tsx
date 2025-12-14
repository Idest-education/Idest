"use client";

import { AlertTriangle } from "lucide-react";
import { useMeetStore } from "@/hooks/useMeetStore";

export function MeetStatusBanner() {
  const error = useMeetStore((state) => state.error);
  const isJoining = useMeetStore((state) => state.isJoining);

  if (!error && !isJoining) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
        error
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-muted bg-muted/40 text-muted-foreground"
      }`}
    >
      {error ? <AlertTriangle className="h-4 w-4" /> : null}
      <span>{error || "Đang kết nối với buổi học..."}</span>
    </div>
  );
}

