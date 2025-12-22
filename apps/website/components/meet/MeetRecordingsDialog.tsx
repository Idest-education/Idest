"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Film, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getRecordingUrl,
  listSessionRecordings,
  type MeetRecordingListItem,
} from "@/services/meet.service";

export function MeetRecordingsDialog({ sessionId }: { sessionId: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MeetRecordingListItem[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const canOpen = Boolean(sessionId);

  const fetchList = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await listSessionRecordings(sessionId);
      setItems(res.items || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load recordings";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (open) {
      setActiveUrl(null);
      fetchList();
    }
  }, [open, fetchList]);

  const title = useMemo(() => {
    if (!sessionId) return "Recordings";
    return `Recordings`;
  }, [sessionId]);

  const play = useCallback(async (item: MeetRecordingListItem) => {
    if (item.url) {
      setActiveUrl(item.url);
      return;
    }
    if (!item.recordingId) {
      toast.error("Recording URL is not available yet.");
      return;
    }
    try {
      const res = await getRecordingUrl(item.recordingId);
      if (!res.url) {
        toast.error("Recording is stored privately; no public/signed URL is configured.");
        return;
      }
      setActiveUrl(res.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to get recording URL";
      toast.error(msg);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canOpen}
          className="h-9 rounded-full"
        >
          <Film className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Recordings</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{title}</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchList}
              disabled={loading || !sessionId}
              className="h-8"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Available recordings</div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No recordings yet.</div>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div
                    key={it.recordingId || it.egressId || String(idx)}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">
                        {it.startedAt ? new Date(it.startedAt).toLocaleString() : "Recording"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {it.stoppedAt
                          ? `Ended: ${new Date(it.stoppedAt).toLocaleString()}`
                          : "In progress or processing"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => play(it)}>
                        Play
                      </Button>
                      {it.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(it.url!, "_blank", "noopener,noreferrer")}
                        >
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Player</div>
            {activeUrl ? (
              <video
                controls
                src={activeUrl}
                className="w-full rounded-md bg-black"
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a recording to play.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}








