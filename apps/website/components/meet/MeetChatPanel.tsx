"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMeetStore } from "@/hooks/useMeetStore";
import { MeetChatMessage } from "@/types/meet";

interface MeetChatPanelProps {
  onSendMessage: (message: string) => void;
  onLoadMore: (before?: string) => void;
}

export function MeetChatPanel({ onSendMessage, onLoadMore }: MeetChatPanelProps) {
  const messages = useMeetStore((state) => state.messages);
  const hasMoreMessages = useMeetStore((state) => state.hasMoreMessages);
  const isLoadingMessages = useMeetStore((state) => state.isLoadingMessages);
  const localUserId = useMeetStore((state) => state.localUserId);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sortedMessages = useMemo(() => {
    // Filter out invalid messages and deduplicate by ID
    const validMessages = messages.filter(
      (msg) => msg && msg.id && msg.sender && msg.sentAt,
    );
    const uniqueMessages = Array.from(
      new Map(validMessages.map((msg) => [msg.id, msg])).values(),
    );
    // Sort by timestamp
    return uniqueMessages.sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    );
  }, [messages]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onSendMessage(draft.trim());
    setDraft("");
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const loadOlder = () => {
    if (!hasMoreMessages) return;
    const oldest = sortedMessages[0];
    onLoadMore(oldest?.sentAt);
  };

  return (
    <div className="flex h-full w-full sm:w-80 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-card shadow-sm">
      <div className="flex-shrink-0 border-b border-border/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Trò chuyện</span>
          {hasMoreMessages && (
            <Button variant="ghost" size="sm" onClick={loadOlder} disabled={isLoadingMessages}>
              Tải tin cũ hơn
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {sortedMessages
          .filter((message) => message && message.sender && message.id)
          .map((message, index) => (
            <ChatMessageBubble
              key={`${message.id}-${message.sentAt}-${index}`}
              message={message}
              isOwnMessage={message.sender?.id === localUserId}
            />
          ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex-shrink-0 border-t border-border/40 p-3">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1"
          />
          <Button type="submit" size="sm">
            Gửi
          </Button>
        </div>
      </form>
    </div>
  );
}

function ChatMessageBubble({
  message,
  isOwnMessage,
}: {
  message: MeetChatMessage;
  isOwnMessage: boolean;
}) {
  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-lg border p-3 max-w-[80%] ${
          isOwnMessage
            ? "bg-blue-500 text-white border-blue-600"
            : "bg-card border-border/40"
        }`}
      >
        {!isOwnMessage && (
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span className={`font-semibold ${isOwnMessage ? "text-white" : "text-foreground"}`}>
              {message.sender.full_name}
            </span>
            <span className={isOwnMessage ? "text-blue-100" : ""}>
              {format(new Date(message.sentAt), "HH:mm")}
            </span>
          </div>
        )}
        {isOwnMessage && (
          <div className="flex items-center justify-end text-xs text-blue-100 mb-1">
            <span>{format(new Date(message.sentAt), "HH:mm")}</span>
          </div>
        )}
        <p className={`text-sm ${isOwnMessage ? "text-white" : "text-foreground"}`}>
          {message.content}
        </p>
      </div>
    </div>
  );
}

