"use client";

import { useEffect, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listGameTemplates, startGameSession } from "@/services/game.service";
import { GameTemplate } from "@/types/game";
import { toast } from "sonner";

interface GameLauncherProps {
  meetingSessionId: string;
}

export function GameLauncher({ meetingSessionId }: GameLauncherProps) {
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    listGameTemplates()
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async (templateId: string) => {
    setStarting(templateId);
    try {
      await startGameSession({ templateId, sessionId: meetingSessionId });
    } catch {
      setStarting(null);
      toast.error("Failed to start game");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "rgba(255,250,245,0.35)" }} />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p style={{ color: "rgba(255,250,245,0.5)", fontSize: 14 }}>
          No games yet. Create one in the Games dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p style={{ color: "rgba(255,250,245,0.5)", fontSize: 13, marginBottom: 4 }}>
        Start a Game
      </p>
      {templates.map((t) => (
        <div
          key={t.id}
          style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fffaf5" }}>{t.title}</p>
            <p style={{ fontSize: 11, color: "rgba(255,250,245,0.35)", marginTop: 2 }}>
              {t.questions.length} questions
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => handleStart(t.id)}
            disabled={!!starting}
            style={{ background: "#7c3aed", color: "white", fontSize: 12 }}
          >
            {starting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
            Start
          </Button>
        </div>
      ))}
    </div>
  );
}
