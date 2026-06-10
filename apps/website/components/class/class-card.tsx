"use client";

import { useRouter } from "next/navigation";
import { ClassData } from "@/types/class";
import { Users, ArrowRight, Clock, GraduationCap, Video } from "lucide-react";

const DAY_SHORT: Record<string, string> = {
  Monday: "T2", Tuesday: "T3", Wednesday: "T4", Thursday: "T5",
  Friday: "T6", Saturday: "T7", Sunday: "CN",
};

function PriceBadge({ price, currency }: { price?: number | null; currency?: string }) {
  if (!price) {
    return (
      <span
        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
        style={{ background: "#dcfce7", color: "#15803d" }}
      >
        Miễn phí
      </span>
    );
  }
  const formatted = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: 0,
  }).format(price);
  return (
    <span
      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
      style={{ background: "#fff7ed", color: "#c2410c" }}
    >
      {formatted}
    </span>
  );
}

export default function ClassCard({ cls, index = 0 }: { cls: ClassData; index?: number }) {
  const router = useRouter();
  const num = String(index + 1).padStart(2, "0");

  return (
    <div
      className="group relative overflow-hidden cursor-pointer animate-in fade-in slide-in-from-bottom-4 flex flex-col"
      style={{
        background: "var(--color-surface-card)",
        border: "1.5px solid var(--color-border-default)",
        borderRadius: 14,
        animationDelay: `${index * 80}ms`,
        animationFillMode: "both",
        transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
        minHeight: 200,
      }}
      onClick={() => router.push(`/classes/${cls.slug}`)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "#FF6B35";
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = "0 10px 28px #FF6B3533";
        const overlay = el.querySelector("[data-hover-overlay]") as HTMLDivElement | null;
        if (overlay) overlay.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--color-border-default)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        const overlay = el.querySelector("[data-hover-overlay]") as HTMLDivElement | null;
        if (overlay) overlay.style.opacity = "0";
      }}
    >
      {/* Gradient hover overlay */}
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
        className="absolute bottom-0 right-2 select-none pointer-events-none opacity-[0.06] group-hover:opacity-[0.10] transition-opacity duration-200"
        style={{
          fontFamily: "Oswald, sans-serif",
          fontSize: 72,
          fontWeight: 700,
          color: "var(--color-brand)",
          lineHeight: 1,
          zIndex: 1,
        }}
        aria-hidden
      >
        {num}
      </span>

      <div className="relative flex flex-col flex-1 p-5" style={{ zIndex: 1 }}>
        {/* Top row: badge + price */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full group-hover:bg-white/20 group-hover:text-white transition-colors duration-200"
            style={{
              background: "var(--color-surface-subtle)",
              color: "var(--color-brand)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            Lớp học
          </span>
          <PriceBadge price={cls.price} currency={cls.currency} />
        </div>

        {/* Class name */}
        <h3
          className="mb-1.5 line-clamp-2 group-hover:text-white transition-colors duration-200"
          style={{
            fontFamily: "Oswald, sans-serif",
            fontWeight: 600,
            fontSize: 17,
            color: "var(--color-text-primary)",
            lineHeight: 1.3,
          }}
        >
          {cls.name}
        </h3>

        {/* Creator */}
        <p
          className="text-[11px] mb-2 group-hover:text-white/70 transition-colors duration-200"
          style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          {cls.creator.full_name}
        </p>

        {/* Description */}
        <p
          className="text-xs line-clamp-2 flex-1 mb-3 group-hover:text-white/75 transition-colors duration-200"
          style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          {cls.description || "Không có mô tả."}
        </p>

        {/* Schedule pill */}
        {cls.schedule && cls.schedule.days.length > 0 && (
          <div
            className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg group-hover:bg-white/15 transition-colors duration-200"
            style={{
              background: "var(--color-surface-subtle)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            <Clock
              className="w-3 h-3 flex-shrink-0 group-hover:text-white/70 transition-colors duration-200"
              style={{ color: "var(--color-brand)" }}
            />
            <span
              className="text-[11px] font-medium group-hover:text-white/80 transition-colors duration-200"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {cls.schedule.days.map((d) => DAY_SHORT[d] || d).join(", ")} · {cls.schedule.time}
            </span>
            <span
              className="ml-auto text-[10px] group-hover:text-white/60 transition-colors duration-200"
              style={{ color: "var(--color-text-muted)" }}
            >
              {cls.schedule.duration}p
            </span>
          </div>
        )}

        {/* Stats footer */}
        <div
          className="flex items-center justify-between pt-3 border-t border-[var(--color-border-default)] group-hover:border-white/20 transition-colors duration-200"
        >
          <div className="flex items-center gap-4">
            <span
              className="flex items-center gap-1 text-xs group-hover:text-white/75 transition-colors duration-200"
              style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              title="Học viên"
            >
              <Users className="w-3.5 h-3.5" />
              {cls._count.members}
            </span>
            <span
              className="flex items-center gap-1 text-xs group-hover:text-white/75 transition-colors duration-200"
              style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              title="Giáo viên"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              {cls._count.teachers}
            </span>
            <span
              className="flex items-center gap-1 text-xs group-hover:text-white/75 transition-colors duration-200"
              style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              title="Buổi học"
            >
              <Video className="w-3.5 h-3.5" />
              {cls._count.sessions}
            </span>
          </div>
          <span
            className="flex items-center gap-1 text-xs font-semibold group-hover:text-white transition-colors duration-200"
            style={{ color: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Chi tiết
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
          </span>
        </div>
      </div>
    </div>
  );
}
