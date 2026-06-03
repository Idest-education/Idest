"use client";

import { useEffect, useRef } from "react";
import { LocalVideoTrack, Track } from "livekit-client";
import type { Room } from "livekit-client";
import { useMeetStore } from "./useMeetStore";
import { useGameStore } from "./useGameStore";

export function useGameCapture(room: Room | null) {
  const isRecording = useMeetStore((s) => s.isRecording);
  const activeGameSessionId = useMeetStore((s) => s.activeGameSessionId);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const gameStatus = useGameStore((s) => s.gameStatus);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Suppress unused-variable warnings — these are intentionally subscribed so the
  // hook re-runs when they change, even though the render loop reads fresh state
  void currentQuestion;
  void leaderboard;
  void gameStatus;

  useEffect(() => {
    if (!isRecording || !activeGameSessionId || !room) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;

    const stream = canvas.captureStream(10);
    streamRef.current = stream;

    const videoTrackNative = stream.getVideoTracks()[0];
    const lkTrack = new LocalVideoTrack(videoTrackNative, undefined, false);
    trackRef.current = lkTrack;

    room.localParticipant.publishTrack(lkTrack, {
      name: "game-view",
      source: Track.Source.ScreenShare,
    });

    const ctx = canvas.getContext("2d")!;

    const render = () => {
      const currentQ = useGameStore.getState().currentQuestion;
      const lb = useGameStore.getState().leaderboard;
      const status = useGameStore.getState().gameStatus;

      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, 1280, 720);

      ctx.font = "bold 28px sans-serif";
      ctx.fillStyle = "#fffaf5";
      ctx.textAlign = "center";

      if (status === "ended") {
        ctx.fillText("Game Over — Final Leaderboard", 640, 80);
        lb.slice(0, 10).forEach((entry, i) => {
          ctx.font = i < 3 ? "bold 22px sans-serif" : "18px sans-serif";
          ctx.fillStyle = i === 0 ? "#fbbf24" : "#fffaf5";
          ctx.fillText(`${entry.rank}. ${entry.displayName} — ${entry.score}`, 640, 140 + i * 50);
        });
      } else if (currentQ) {
        ctx.fillText(`Q${currentQ.questionIndex + 1}: ${currentQ.text}`, 640, 80);

        if (currentQ.type === "MULTIPLE_CHOICE") {
          currentQ.options.forEach((opt, i) => {
            const x = i % 2 === 0 ? 320 : 960;
            const y = i < 2 ? 260 : 460;
            ctx.font = "bold 22px sans-serif";
            ctx.fillStyle = "#a78bfa";
            ctx.fillText(`${opt.label}: ${opt.text}`, x, y);
          });
        }

        ctx.font = "18px sans-serif";
        ctx.fillStyle = "rgba(255,250,245,0.5)";
        ctx.fillText("Live Leaderboard", 640, 560);
        lb.slice(0, 5).forEach((entry, i) => {
          ctx.font = "16px sans-serif";
          ctx.fillStyle = "#fffaf5";
          ctx.fillText(`${entry.rank}. ${entry.displayName}: ${entry.score}`, 640, 595 + i * 25);
        });
      }
    };

    intervalRef.current = setInterval(render, 100); // 10fps

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (trackRef.current) {
        room.localParticipant.unpublishTrack(trackRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      canvasRef.current = null;
      trackRef.current = null;
      streamRef.current = null;
    };
  }, [isRecording, activeGameSessionId, room]);
}
