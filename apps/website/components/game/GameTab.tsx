"use client";

import { useMeetStore } from "@/hooks/useMeetStore";
import { useGameStore } from "@/hooks/useGameStore";
import { useGameSocket } from "@/hooks/useGameSocket";
import { GameLauncher } from "./GameLauncher";
import { GameActiveTeacher } from "./GameActiveTeacher";
import { GameActiveStudent } from "./GameActiveStudent";
import { GameEnded } from "./GameEnded";

interface GameTabProps {
  meetingSessionId: string;
  isTeacher: boolean;
}

export function GameTab({ meetingSessionId, isTeacher }: GameTabProps) {
  const activeGameSessionId = useMeetStore((s) => s.activeGameSessionId);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const activeSession = useGameStore((s) => s.activeSession);

  useGameSocket(activeGameSessionId);

  if (gameStatus === "ended") {
    return <GameEnded />;
  }

  if (!activeGameSessionId || gameStatus === "idle") {
    if (!isTeacher) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <p style={{ fontSize: 14, color: "rgba(255,250,245,0.35)" }}>
            Wait for your teacher to start a game.
          </p>
        </div>
      );
    }
    return <GameLauncher meetingSessionId={meetingSessionId} />;
  }

  const questionCount = activeSession?.template?.questions?.length ?? 0;

  if (isTeacher) {
    return (
      <GameActiveTeacher
        gameSessionId={activeGameSessionId}
        questionCount={questionCount}
      />
    );
  }

  return <GameActiveStudent gameSessionId={activeGameSessionId} />;
}
