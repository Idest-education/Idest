"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameQuestionEditor } from "@/components/game/GameQuestionEditor";
import { createGameTemplate } from "@/services/game.service";
import { CreateGameTemplateDto } from "@/types/game";
import { toast } from "sonner";

export default function NewGamePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<CreateGameTemplateDto["questions"]>([
    { text: "", type: "MULTIPLE_CHOICE", order: 1, timerSeconds: 20, correctAnswer: "",
      options: [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }] },
  ]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || questions.length === 0) {
      toast.error("Title and at least one question are required");
      return;
    }
    setSaving(true);
    try {
      await createGameTemplate({ title, description: description || undefined, questions });
      toast.success("Game created!");
      router.push("/games");
    } catch {
      toast.error("Failed to create game");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24 }}>New Game</h1>

      <div className="flex flex-col gap-4 mb-6">
        <Input
          placeholder="Game title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <GameQuestionEditor questions={questions} onChange={setQuestions} />

      <div className="flex gap-3 mt-6">
        <Button onClick={handleSave} disabled={saving} style={{ background: "#7c3aed", color: "white" }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Game
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
