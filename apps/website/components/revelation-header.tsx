"use client";

import Image from "next/image";
import type { StaticImageData } from "next/image";
import ScoreReveal from "@/components/score-reveal";
import Link from "next/link";

interface Props {
  score: number;
  scoreSuffix?: string;
  catImage: StaticImageData;
  comment: string;
  backHref: string;
  primaryCTA?: { label: string; href: string };
}

export default function RevelationHeader({
  score,
  scoreSuffix = "/ 9.0",
  catImage,
  comment,
  backHref,
  primaryCTA,
}: Props) {
  return (
    <div className="w-full">
      {/* Animated color stripe */}
      <div
        className="h-1 w-full animate-stripe-flow"
        style={{
          background: "linear-gradient(90deg, #dc2626, #FF6B35, #fbbf24, #FF6B35, #dc2626)",
          backgroundSize: "200% 100%",
        }}
      />

      {/* Header area */}
      <div
        className="w-full px-6 sm:px-10 pt-10 pb-8 flex flex-col items-center gap-4"
        style={{
          background: "linear-gradient(160deg, #fff4ed 0%, #ffe8d6 100%)",
        }}
      >
        {/* Floating cat */}
        <div className="animate-float">
          <Image src={catImage} alt="" width={88} height={88} className="object-contain" priority />
        </div>

        {/* Score */}
        <ScoreReveal score={score} suffix={scoreSuffix} />

        {/* Comment */}
        <p
          className="text-sm font-medium text-center"
          style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-body)" }}
        >
          {comment}
        </p>

        {/* Action bar */}
        <div className="flex items-center gap-3 mt-2">
          <Link
            href={backHref}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-secondary)",
              backgroundColor: "var(--color-surface-card)",
            }}
          >
            Luyện thêm
          </Link>
          {primaryCTA && (
            <Link
              href={primaryCTA.href}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "#FF6B35", color: "#ffffff" }}
            >
              {primaryCTA.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
