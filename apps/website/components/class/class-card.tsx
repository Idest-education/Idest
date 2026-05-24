"use client";

import { useRouter } from "next/navigation";
import { ClassData } from "@/types/class";
import { Users, ArrowRight } from "lucide-react";

export default function ClassCard({ cls, index = 0 }: { cls: ClassData; index?: number }) {
  const router = useRouter();
  const num = String(index + 1).padStart(2, "0");

  return (
    <div
      className="group relative overflow-hidden cursor-pointer animate-in fade-in slide-in-from-bottom-4"
      style={{
        background: "var(--color-surface-card)",
        border: "1.5px solid var(--color-border-default)",
        borderRadius: 12,
        animationDelay: `${index * 100}ms`,
        animationFillMode: "both",
        transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
      }}
      onClick={() => router.push(`/classes/${cls.slug}`)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "#FF6B35";
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = "0 12px 32px #FF6B3544";
        // Show gradient overlay
        const overlay = el.querySelector("[data-hover-overlay]") as HTMLDivElement | null;
        if (overlay) overlay.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--color-border-default)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        // Hide gradient overlay
        const overlay = el.querySelector("[data-hover-overlay]") as HTMLDivElement | null;
        if (overlay) overlay.style.opacity = "0";
      }}
    >
      {/* Gradient overlay — fades in on hover (opacity transition works; background-gradient transition doesn't) */}
      <div
        data-hover-overlay
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, #FF6B35 0%, #c94010 100%)",
          opacity: 0,
          transition: "opacity 200ms ease",
          zIndex: 0,
        }}
      />

      {/* Ghost number watermark */}
      <span
        className="absolute top-2 right-3 select-none pointer-events-none opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-200"
        style={{
          fontFamily: "Oswald, sans-serif",
          fontSize: 80,
          fontWeight: 700,
          color: "var(--color-brand)",
          lineHeight: 1,
          zIndex: 1,
        }}
        aria-hidden
      >
        {num}
      </span>

      <div className="relative p-6 flex flex-col h-full" style={{ zIndex: 1 }}>
        {/* Skill pill */}
        <div className="mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full transition-colors duration-200 group-hover:text-white"
            style={{
              background: "var(--color-brand)",
              color: "#fff",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            Lớp học
          </span>
        </div>

        {/* Class name */}
        <h3
          className="mb-2 line-clamp-2 group-hover:text-white transition-colors duration-200"
          style={{
            fontFamily: "Oswald, sans-serif",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--color-text-primary)",
          }}
        >
          {cls.name}
        </h3>

        {/* Description */}
        <p
          className="text-xs line-clamp-2 flex-1 mb-4 group-hover:text-white/80 transition-colors duration-200"
          style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          {cls.description}
        </p>

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-4 border-t border-[var(--color-border-default)] group-hover:border-white/20 transition-colors duration-200"
        >
          <div className="flex items-center gap-4">
            <span
              className="flex items-center gap-1 text-xs group-hover:text-white/80 transition-colors duration-200"
              style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              <Users className="w-3.5 h-3.5" />
              {cls._count.members}
            </span>
            <span
              className="flex items-center gap-1 text-xs group-hover:text-white/80 transition-colors duration-200"
              style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {cls._count.sessions}
            </span>
          </div>
          <span
            className="flex items-center gap-1 text-xs font-medium group-hover:text-white transition-colors duration-200"
            style={{ color: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Xem chi tiết
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
          </span>
        </div>
      </div>
    </div>
  );
}
