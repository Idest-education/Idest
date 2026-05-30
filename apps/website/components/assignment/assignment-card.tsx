"use client";

import { useState } from "react";
import { AssignmentOverview } from "@/types/assignment";
import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

interface SkillConfig {
  label: string;
  accent: string;
  accentDeep: string;
}

const SKILL_CONFIG: Record<string, SkillConfig> = {
  reading:   { label: "Đọc hiểu", accent: "#FF6B35", accentDeep: "#c94010" },
  listening: { label: "Nghe",     accent: "#fbbf24", accentDeep: "#c47d06" },
  writing:   { label: "Viết",     accent: "#dc2626", accentDeep: "#7f1d1d" },
  speaking:  { label: "Nói",      accent: "#f59e0b", accentDeep: "#92400e" },
};

export default function AssignmentCard({ item, index = 0 }: { item: AssignmentOverview; index?: number }) {
  const [hovered, setHovered] = useState(false);
  const link = `/assignment/${item.skill}/${item.id}`;
  const config = SKILL_CONFIG[item.skill] ?? SKILL_CONFIG.reading;
  const ghost = String(index + 1).padStart(2, "0");

  return (
    <Link href={link} className="block">
      <div
        className="relative flex flex-col rounded-xl overflow-hidden"
        style={{
          background: hovered
            ? `linear-gradient(135deg, ${config.accent} 0%, ${config.accentDeep} 100%)`
            : "var(--color-surface-card)",
          border: `1.5px solid ${hovered ? config.accent : "var(--color-border-default)"}`,
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          boxShadow: hovered ? `0 12px 32px ${config.accent}44` : "none",
          transition: "background-color 200ms ease, border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Ghost index */}
        <span
          className="absolute top-0 right-2 font-bold leading-none select-none pointer-events-none"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "80px",
            color: hovered ? "#ffffff" : config.accent,
            opacity: hovered ? 0.15 : 0.07,
            transition: "color 200ms ease, opacity 200ms ease",
          }}
        >
          {ghost}
        </span>

        {/* Content */}
        <div className="flex flex-col flex-1 px-5 py-5 gap-3">
          <div
            className="self-start text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: hovered ? "rgba(255,255,255,0.25)" : config.accent,
              color: "#ffffff",
              fontFamily: "var(--font-body)",
              transition: "background-color 200ms ease",
            }}
          >
            {config.label}
          </div>

          <h3
            className="font-bold leading-snug line-clamp-2"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              color: hovered ? "#ffffff" : "var(--color-text-primary)",
              transition: "color 200ms ease",
            }}
          >
            {item.title}
          </h3>

          <p
            className="text-sm leading-relaxed line-clamp-2 flex-1"
            style={{
              color: hovered ? "rgba(255,255,255,0.80)" : "var(--color-text-muted)",
              transition: "color 200ms ease",
            }}
          >
            {item.description}
          </p>

          <div
            className="flex items-center justify-between pt-3"
            style={{
              borderTop: `1px solid ${hovered ? "rgba(255,255,255,0.20)" : "var(--color-border-subtle)"}`,
              transition: "border-color 200ms ease",
            }}
          >
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{
                color: hovered ? "rgba(255,255,255,0.70)" : "var(--color-text-muted)",
                transition: "color 200ms ease",
              }}
            >
              <Calendar className="w-3 h-3" />
              {new Date(item.created_at).toLocaleDateString("vi-VN")}
            </div>
            <span
              className="text-xs font-semibold flex items-center gap-1"
              style={{
                color: hovered ? "#ffffff" : config.accent,
                fontFamily: "var(--font-body)",
                transition: "color 200ms ease",
              }}
            >
              Xem chi tiết
              <ArrowRight
                className="w-3 h-3"
                style={{
                  transform: hovered ? "translateX(2px)" : "translateX(0)",
                  transition: "transform 200ms ease",
                }}
              />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
