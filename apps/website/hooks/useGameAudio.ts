"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "./useGameStore";

export function useGameAudio() {
  const gameStatus = useGameStore((s) => s.gameStatus);
  const roundResult = useGameStore((s) => s.roundResult);
  const questionIndex = useGameStore((s) => s.currentQuestion?.questionIndex ?? -1);

  const lobbyRef = useRef<HTMLAudioElement | null>(null);
  const leaderboardRef = useRef<HTMLAudioElement | null>(null);
  const popupRef = useRef<HTMLAudioElement | null>(null);
  const prevRoundResult = useRef(roundResult);

  useEffect(() => {
    lobbyRef.current = new Audio("/assets/lobbymusic.mp3");
    lobbyRef.current.loop = true;
    lobbyRef.current.volume = 0.35;

    leaderboardRef.current = new Audio("/assets/Leaderboard.mp3");
    leaderboardRef.current.loop = false;
    leaderboardRef.current.volume = 0.35;

    popupRef.current = new Audio("/assets/popup.mp3");
    popupRef.current.volume = 0.6;

    return () => {
      lobbyRef.current?.pause();
      leaderboardRef.current?.pause();
      popupRef.current?.pause();
    };
  }, []);

  // Each new question: restart lobby music
  useEffect(() => {
    if (questionIndex < 0) return;
    const lobby = lobbyRef.current;
    if (!lobby) return;
    lobby.pause();
    lobby.currentTime = 0;
    lobby.play().catch(() => {});
    // intentionally only depends on questionIndex — restart on each new question
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex]);

  // Round result appears: stop lobby, play popup
  useEffect(() => {
    if (roundResult !== null && prevRoundResult.current === null) {
      lobbyRef.current?.pause();
      const popup = popupRef.current;
      if (popup) {
        popup.currentTime = 0;
        popup.play().catch(() => {});
      }
    }
    prevRoundResult.current = roundResult;
  }, [roundResult]);

  // Game ended: play leaderboard music
  useEffect(() => {
    if (gameStatus === "ended") {
      lobbyRef.current?.pause();
      popupRef.current?.pause();
      const lb = leaderboardRef.current;
      if (lb) {
        lb.currentTime = 0;
        lb.play().catch(() => {});
      }
    } else if (gameStatus === "idle") {
      lobbyRef.current?.pause();
      leaderboardRef.current?.pause();
    }
  }, [gameStatus]);
}
