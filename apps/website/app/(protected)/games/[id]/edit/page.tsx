"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameQuestionEditor } from "@/components/game/GameQuestionEditor";
import { getGameTemplate, updateGameTemplate } from "@/services/game.service";
import { CreateGameTemplateDto } from "@/types/game";
import { toast } from "sonner";

export default function EditGamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<CreateGameTemplateDto["questions"]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGameTemplate(params.id)
      .then((t) => {
        setTitle(t.title);
        setDescription(t.description ?? "");
        setQuestions(
          t.questions.map((q) => ({
            text: q.text,
            type: q.type,
            order: q.order,
            timerSeconds: q.timerSeconds,
            correctAnswer: q.correctAnswer ?? "",
            options: q.options?.map((o) => ({ label: o.label, text: o.text })),
            matchPairs: q.matchPairs?.map((p) => ({ leftText: p.leftLabel, rightText: p.rightText })),
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Game title is required");
      return;
    }
    const emptyText = questions.findIndex((q) => !q.text.trim());
    if (emptyText !== -1) {
      toast.error(`Question ${emptyText + 1} is missing its question text`);
      return;
    }
    const missingAnswer = questions.findIndex(
      (q) => q.type !== "WORD_CLOUD" && q.type !== "MATCH_LR" && !q.correctAnswer.trim(),
    );
    if (missingAnswer !== -1) {
      toast.error(`Question ${missingAnswer + 1} is missing a correct answer`);
      return;
    }
    setSaving(true);
    try {
      await updateGameTemplate(params.id, { title, description: description || undefined, questions });
      toast.success("Game updated!");
      router.push("/games");
    } catch {
      toast.error("Failed to update game");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24 }}>Edit Game</h1>

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
          Save Changes
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
