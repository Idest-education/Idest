"use client";

import { create } from "zustand";
import {
  GameSession,
  GameQuestionStartedEvent,
  LeaderboardEntry,
  GameStatus,
} from "@/types/game";

interface RoundResult {
  isCorrect: boolean;
  pointsAwarded: number;
  correctAnswer: string;
}

interface GameStore {
  activeSession: GameSession | null;
  currentQuestion: GameQuestionStartedEvent | null;
  questionStartedAt: number | null;
  myScore: number;
  myRank: number | null;
  leaderboard: LeaderboardEntry[];
  gameStatus: GameStatus;
  hasSubmitted: boolean;
  roundResult: RoundResult | null;

  setActiveSession: (session: GameSession | null) => void;
  setCurrentQuestion: (q: GameQuestionStartedEvent | null) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setMyScore: (score: number) => void;
  setMyRank: (rank: number | null) => void;
  setGameStatus: (status: GameStatus) => void;
  setHasSubmitted: (v: boolean) => void;
  setRoundResult: (result: RoundResult | null) => void;
  reset: () => void;
}

const initial = {
  activeSession: null,
  currentQuestion: null,
  questionStartedAt: null,
  myScore: 0,
  myRank: null,
  leaderboard: [],
  gameStatus: 'idle' as GameStatus,
  hasSubmitted: false,
  roundResult: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initial,

  setActiveSession: (activeSession) => set({ activeSession }),
  setCurrentQuestion: (currentQuestion) =>
    set({ currentQuestion, questionStartedAt: currentQuestion ? Date.now() : null }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setMyScore: (myScore) => set({ myScore }),
  setMyRank: (myRank) => set({ myRank }),
  setGameStatus: (gameStatus) => set({ gameStatus }),
  setHasSubmitted: (hasSubmitted) => set({ hasSubmitted }),
  setRoundResult: (roundResult) => set({ roundResult }),
  reset: () => set({ ...initial }),
}));
