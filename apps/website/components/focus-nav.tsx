"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logoIcon from "@/assets/logo-icon.png";

const SKILL_LABELS: Record<string, string> = {
  reading: "Đọc hiểu",
  listening: "Nghe",
  writing: "Viết",
  speaking: "Nói",
};

export default function FocusNav() {
  const pathname = usePathname();

  // Extract skill from pathname: /assignment/reading/[id]
  const segments = pathname?.split("/") ?? [];
  const skillSegmentIndex = segments.indexOf("assignment") + 1;
  const skill = segments[skillSegmentIndex] ?? "";
  const skillLabel = SKILL_LABELS[skill] ?? "Bài thi";

  return (
    <nav
      className="sticky top-0 z-50 w-full h-11 flex items-center justify-between px-4"
      style={{
        backgroundColor: "var(--color-surface-app)",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Left: logo icon + skill label */}
      <div className="flex items-center gap-2">
        <Link href="/assignment" aria-label="Quay lại bài tập">
          <Image src={logoIcon} alt="" width={20} height={20} className="opacity-70" />
        </Link>
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
            letterSpacing: "0.08em",
          }}
        >
          {skillLabel}
        </span>
      </div>

      {/* Right: keyboard hints */}
      <div
        className="hidden md:flex items-center gap-3 text-xs"
        style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
      >
        <span>
          <kbd
            className="px-1.5 py-0.5 rounded text-xs"
            style={{ border: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)" }}
          >
            Tab
          </kbd>{" "}
          câu tiếp
        </span>
        <span>
          <kbd
            className="px-1.5 py-0.5 rounded text-xs"
            style={{ border: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)" }}
          >
            Space
          </kbd>{" "}
          chọn
        </span>
      </div>
    </nav>
  );
}
