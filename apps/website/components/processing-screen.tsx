"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import readingCat from "@/assets/assignment-reading.png";
import listeningCat from "@/assets/assignment-listening.png";
import writingCat from "@/assets/assignment-writing.png";
import speakingCat from "@/assets/assignment-speaking.png";

const CAT_IMAGES = {
  reading: readingCat,
  listening: listeningCat,
  writing: writingCat,
  speaking: speakingCat,
};

const TYPEWRITER_MESSAGES = [
  "Đang đọc từng câu của bạn...",
  "Kiểm tra Task Achievement...",
  "Xem mạch lạc có ổn không...",
  "Đánh giá Lexical Resource...",
  "Kiểm tra ngữ pháp...",
  "Sắp xong rồi, chờ tí nha!",
];

interface Props {
  skill: "reading" | "listening" | "writing" | "speaking";
}

export default function ProcessingScreen({ skill }: Props) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMessageIndex((i) => (i + 1) % TYPEWRITER_MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const catImage = CAT_IMAGES[skill];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8"
      style={{ backgroundColor: "#0d0905" }}
    >
      {/* Breathing orb */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full animate-breathe"
          style={{
            width: "240px",
            height: "240px",
            background:
              "radial-gradient(circle, rgba(255,107,53,0.45) 0%, rgba(220,38,38,0.2) 50%, transparent 75%)",
          }}
        />
        <div
          className="absolute rounded-full animate-breathe"
          style={{
            width: "160px",
            height: "160px",
            background:
              "radial-gradient(circle, rgba(255,107,53,0.6) 0%, rgba(220,38,38,0.3) 60%, transparent 80%)",
            animationDelay: "0.3s",
          }}
        />

        {/* Cat floats above orb */}
        <div className="relative z-10 animate-float" style={{ marginTop: "-24px" }}>
          <Image
            src={catImage}
            alt=""
            width={100}
            height={100}
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Typewriter text */}
      <div className="flex flex-col items-center gap-3">
        <p
          className="text-base font-medium transition-opacity duration-300"
          style={{
            color: "rgba(255,255,255,0.85)",
            fontFamily: "var(--font-body)",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.3s, transform 0.3s",
          }}
        >
          {TYPEWRITER_MESSAGES[messageIndex]}
        </p>
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-body)" }}
        >
          Thường mất khoảng 15–30 giây
        </p>
      </div>

      {/* Warm pulsing dots */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{
              backgroundColor: "#FF6B35",
              animationDelay: `${i * 0.25}s`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </div>
  );
}
