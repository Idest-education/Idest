"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { conversationService } from "@/services/conversation.service";
import type { ConversationDto } from "@/types/conversation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UploadCloud } from "lucide-react";

interface EditGroupConversationProps {
  conversationId: string;
  initialTitle?: string;
  initialAvatarUrl?: string | null;
  onUpdated?: (conversation: ConversationDto) => void;
}

export default function EditGroupConversation({
  conversationId,
  initialTitle,
  initialAvatarUrl,
  onUpdated,
}: EditGroupConversationProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle || "");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(initialAvatarUrl || undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSave = useMemo(() => {
    return title.trim().length > 0 || !!avatarUrl;
  }, [title, avatarUrl]);

  const uploadAvatar = async (file: File) => {
    const supabase = createClient();
    const bucket = process.env.NEXT_PUBLIC_CHAT_FILES_BUCKET || "avatars";
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    const path = `conversation-avatars/${conversationId}/${uuid}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return publicUrl;
  };

  const handlePickAvatar = () => fileInputRef.current?.click();

  const handleFileSelected = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
    } catch (e: any) {
      setError(e?.message || "Failed to upload avatar");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!canSave) return;

    setBusy(true);
    try {
      const updated = await conversationService.updateConversation(conversationId, {
        title: title.trim() || undefined,
        avatar_url: avatarUrl,
      });
      onUpdated?.(updated);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Failed to update conversation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit group
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-xl !z-[10001] max-h-fit overflow-y-auto" 
        overlayClassName="!z-[10001]"
      >
        <DialogHeader>
          <DialogTitle>Edit group chat</DialogTitle>
          <DialogDescription>Update group title and avatar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Group title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Group name" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Group avatar</label>

            <div className="flex items-center gap-3">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Group avatar" className="w-14 h-14 rounded-full object-cover border" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-orange-100 border border-orange-200" />
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelected(file);
                  e.target.value = "";
                }}
              />

              <Button type="button" variant="outline" onClick={handlePickAvatar} disabled={busy}>
                <UploadCloud className="w-4 h-4" />
                Upload
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={busy || !canSave}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}






