"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listGameTemplates, deleteGameTemplate } from "@/services/game.service";
import { GameTemplate } from "@/types/game";
import { toast } from "sonner";

export default function GamesPage() {
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setTemplates(await listGameTemplates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this game template?")) return;
    setDeleting(id);
    try {
      await deleteGameTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Game deleted");
    } catch {
      toast.error("Failed to delete game");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fffaf5" }}>My Games</h1>
        <Link href="/games/new">
          <Button style={{ background: "#7c3aed", color: "white" }}>
            <Plus className="h-4 w-4 mr-2" />
            New Game
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(255,250,245,0.35)" }} />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12" style={{ color: "rgba(255,250,245,0.35)", fontSize: 14 }}>
          No games yet. Create your first game!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fffaf5" }}>{t.title}</p>
                <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", marginTop: 2 }}>
                  {t.questions.length} questions
                  {t.description && ` · ${t.description}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/games/${t.id}/edit`}>
                  <Button variant="outline" size="sm" style={{ borderColor: "#2a2a2a", color: "rgba(255,250,245,0.5)", background: "transparent" }}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  style={{ borderColor: "#2a2a2a", color: "#f87171", background: "transparent" }}
                >
                  {deleting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
