import { AssignmentOverview } from "@/types/assignment";
import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import readingCat from "@/assets/assignment-reading.png";
import listeningCat from "@/assets/assignment-listening.png";
import writingCat from "@/assets/assignment-writing.png";
import speakingCat from "@/assets/assignment-speaking.png";

interface SkillConfig {
  label: string;
  accent: string;
  accentSubtle: string;
  image: StaticImageData;
}

const SKILL_CONFIG: Record<string, SkillConfig> = {
  reading: {
    label: "Đọc hiểu",
    accent: "#FF6B35",
    accentSubtle: "rgba(255,107,53,0.06)",
    image: readingCat,
  },
  listening: {
    label: "Nghe",
    accent: "#fbbf24",
    accentSubtle: "rgba(251,191,36,0.07)",
    image: listeningCat,
  },
  writing: {
    label: "Viết",
    accent: "#dc2626",
    accentSubtle: "rgba(220,38,38,0.05)",
    image: writingCat,
  },
  speaking: {
    label: "Nói",
    accent: "#f59e0b",
    accentSubtle: "rgba(245,158,11,0.06)",
    image: speakingCat,
  },
};

export default function AssignmentCard({ item }: { item: AssignmentOverview }) {
  const link = `/assignment/${item.skill}/${item.id}`;
  const config = SKILL_CONFIG[item.skill] ?? SKILL_CONFIG.reading;

  return (
    <Link href={link} className="group block">
      <div
        className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
        style={{
          backgroundColor: "var(--color-surface-card)",
          border: `1.5px solid ${config.accent}`,
        }}
      >
        {/* Cat mascot */}
        <div
          className="relative h-36 flex items-center justify-center"
          style={{ backgroundColor: config.accentSubtle }}
        >
          <div className="relative w-24 h-24 transition-transform duration-200 group-hover:-translate-y-0.5">
            <Image
              src={config.image}
              alt=""
              fill
              className="object-contain"
              sizes="96px"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5 gap-3">
          <div
            className="self-start text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: config.accent,
              color: "#ffffff",
              fontFamily: "var(--font-body)",
            }}
          >
            {config.label}
          </div>

          <h3
            className="font-bold leading-snug line-clamp-2"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              color: "var(--color-text-primary)",
            }}
          >
            {item.title}
          </h3>

          <p
            className="text-sm leading-relaxed line-clamp-3 flex-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {item.description}
          </p>

          <div
            className="flex items-center justify-between pt-3"
            style={{ borderTop: "1px solid var(--color-border-subtle)" }}
          >
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Calendar className="w-3 h-3" />
              {new Date(item.created_at).toLocaleDateString("vi-VN")}
            </div>
            <span
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: config.accent, fontFamily: "var(--font-body)" }}
            >
              Xem chi tiết
              <ArrowRight className="w-3 h-3 transition-transform duration-150 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
