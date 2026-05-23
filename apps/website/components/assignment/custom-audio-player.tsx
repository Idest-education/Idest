"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  maxReplays?: number;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CustomAudioPlayer({ src, maxReplays = 2 }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [replaysLeft, setReplaysLeft] = useState(maxReplays);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  function handleReplay() {
    const audio = audioRef.current;
    if (!audio || replaysLeft <= 0) return;
    audio.currentTime = 0;
    audio.play();
    setPlaying(true);
    setReplaysLeft((n) => n - 1);
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 rounded-2xl"
      style={{
        backgroundColor: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      {/* Play/pause button */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:brightness-110"
        style={{ backgroundColor: "#FF6B35", color: "#ffffff" }}
        aria-label={playing ? "Dừng" : "Phát"}
      >
        {playing ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-1.5 rounded-full overflow-hidden cursor-pointer"
          style={{ backgroundColor: "var(--color-surface-muted)" }}
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            audio.currentTime = (x / rect.width) * duration;
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #FF6B35, #fbbf24)",
              transition: "width 0.1s linear",
            }}
          />
        </div>
        <div className="flex justify-between">
          <span
            className="text-xs"
            style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--color-text-muted)" }}
          >
            {formatTime(currentTime)}
          </span>
          <span
            className="text-xs"
            style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--color-text-muted)" }}
          >
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Replay counter */}
      <button
        onClick={handleReplay}
        disabled={replaysLeft <= 0}
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
        style={{
          backgroundColor: "var(--color-surface-subtle)",
          color: "var(--color-text-secondary)",
          border: "1px solid var(--color-border-default)",
        }}
        title={replaysLeft > 0 ? `Nghe lại (còn ${replaysLeft} lần)` : "Hết lượt nghe lại"}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Nghe lại ({replaysLeft})
      </button>
    </div>
  );
}
