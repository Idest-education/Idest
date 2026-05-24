"use client";

import { AlertTriangle } from "lucide-react";
import { useMeetStore } from "@/hooks/useMeetStore";

export function MeetStatusBanner() {
  const error = useMeetStore((state) => state.error);
  const isJoining = useMeetStore((state) => state.isJoining);

  if (!error && !isJoining) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm`}
      style={
        error
          ? { borderColor: "rgba(220,38,38,0.4)", background: "rgba(220,38,38,0.1)", color: "var(--color-error)" }
          : { borderColor: "#2a2a2a", background: "rgba(26,10,0,0.6)", color: "rgba(255,250,245,0.7)" }
      }
    >
      {error ? <AlertTriangle className="h-4 w-4" /> : null}
      <span>{error || "Đang kết nối với buổi học..."}</span>
    </div>
  );
}
