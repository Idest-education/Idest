"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { createGameSocket } from "@/lib/game-socket";
import { useGameStore } from "./useGameStore";
import { useMeetStore } from "./useMeetStore";
import {
  GameQuestionStartedEvent,
  GameQuestionEndedEvent,
  GameLeaderboardUpdatedEvent,
  GameSessionEndedEvent,
} from "@/types/game";

export function useGameSocket(gameSessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);

  const setCurrentQuestion = useGameStore((state) => state.setCurrentQuestion);
  const setLeaderboard = useGameStore((state) => state.setLeaderboard);
  const setGameStatus = useGameStore((state) => state.setGameStatus);
  const setHasSubmitted = useGameStore((state) => state.setHasSubmitted);
  const setRoundResult = useGameStore((state) => state.setRoundResult);
  const setMyScore = useGameStore((state) => state.setMyScore);
  const setMyRank = useGameStore((state) => state.setMyRank);
  const reset = useGameStore((state) => state.reset);

  const connect = useCallback(
    async (id: string) => {
      if (socketRef.current) return;
      const supabase = createSupabaseClient();
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const socket = createGameSocket(token);
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("game:join_room", { gameSessionId: id, userId: useMeetStore.getState().localUserId });
      });

      socket.on("game:question_started", (payload: GameQuestionStartedEvent) => {
        setCurrentQuestion(payload);
        setGameStatus("active");
        setHasSubmitted(false);
        setRoundResult(null);
      });

      socket.on("game:question_ended", (payload: GameQuestionEndedEvent) => {
        const currentUserId = useMeetStore.getState().localUserId;
        const myPoints = payload.pointsBreakdown.find((p) => p.userId === currentUserId);
        setRoundResult({
          isCorrect: (myPoints?.pointsAwarded ?? 0) > 0,
          pointsAwarded: myPoints?.pointsAwarded ?? 0,
          correctAnswer: payload.correctAnswer,
        });
      });

      socket.on("game:leaderboard_updated", (payload: GameLeaderboardUpdatedEvent) => {
        const currentUserId = useMeetStore.getState().localUserId;
        const myEntry = payload.top10.find((e) => e.userId === currentUserId);
        if (myEntry) {
          setMyScore(myEntry.score);
          setMyRank(payload.top10.indexOf(myEntry) + 1);
        } else {
          setMyRank(null);
        }
        setLeaderboard(
          payload.top10.map((e, i) => ({
            rank: i + 1,
            userId: e.userId,
            displayName: e.displayName,
            score: e.score,
          })),
        );
      });

      socket.on("game:session_ended", (payload: GameSessionEndedEvent) => {
        setLeaderboard(payload.leaderboard);
        setGameStatus("ended");
        setCurrentQuestion(null);
      });

      socket.connect();
    },
    [setCurrentQuestion, setGameStatus, setHasSubmitted, setLeaderboard, setMyRank, setMyScore, setRoundResult],
  );

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      if (gameSessionId) socket.emit("game:leave_room", { gameSessionId });
      socket.removeAllListeners();
      socket.disconnect();
    }
    socketRef.current = null;
    reset();
  }, [gameSessionId, reset]);

  useEffect(() => {
    if (!gameSessionId) return;
    connect(gameSessionId);
    return () => disconnect();
  }, [gameSessionId, connect, disconnect]);

  return { socket: socketRef.current };
}
