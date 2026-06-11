"use client";

import { create } from "zustand";
import {
  GameSession,
  GameQuestionStartedEvent,
  LeaderboardEntry,
  GameStatus,
  WordCloudEntry,
  DistributionEntry,
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
  wordCloudWords: WordCloudEntry[];
  answerStreak: number;
  maxAnswerStreak: number;
  distribution: DistributionEntry[];
  isPaused: boolean;
  timerExtended: { newTimerSeconds: number; elapsedSeconds: number } | null;

  setActiveSession: (session: GameSession | null) => void;
  setCurrentQuestion: (q: GameQuestionStartedEvent | null) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setMyScore: (score: number) => void;
  setMyRank: (rank: number | null) => void;
  setGameStatus: (status: GameStatus) => void;
  setHasSubmitted: (v: boolean) => void;
  setRoundResult: (result: RoundResult | null) => void;
  setWordCloudWords: (words: WordCloudEntry[]) => void;
  setAnswerStreak: (streak: number, max: number) => void;
  setDistribution: (entries: DistributionEntry[]) => void;
  setIsPaused: (paused: boolean) => void;
  setTimerExtended: (data: { newTimerSeconds: number; elapsedSeconds: number } | null) => void;
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
  wordCloudWords: [] as WordCloudEntry[],
  answerStreak: 0,
  maxAnswerStreak: 0,
  distribution: [] as DistributionEntry[],
  isPaused: false,
  timerExtended: null as { newTimerSeconds: number; elapsedSeconds: number } | null,
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
  setWordCloudWords: (wordCloudWords) => set({ wordCloudWords }),
  setAnswerStreak: (answerStreak, maxAnswerStreak) => set({ answerStreak, maxAnswerStreak }),
  setDistribution: (distribution) => set({ distribution }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setTimerExtended: (timerExtended) => set({ timerExtended }),
  reset: () => set({ ...initial }),
}));
