"use client";

import Image from "next/image";
import logoIcon from "@/assets/logo-icon.png";

export default function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--color-surface-app)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin-slow">
          <Image
            src={logoIcon}
            alt=""
            width={52}
            height={52}
            priority
          />
        </div>
        <p
          className="text-sm font-medium"
          style={{
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          Đang tải...
        </p>
      </div>
    </div>
  );
}
