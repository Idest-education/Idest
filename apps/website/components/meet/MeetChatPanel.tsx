"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMeetStore } from "@/hooks/useMeetStore";
import { MeetChatMessage } from "@/types/meet";
import { formatMessageTime } from "@/lib/utils/date-format";

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

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 bg-gradient-to-b from-gray-50/50 to-white scroll-smooth">
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
    <div className={`flex items-end gap-2 ${isOwnMessage ? "justify-end" : "justify-start"} mb-1 animate-fadeIn`}>
      {!isOwnMessage && (
        <div className="flex-shrink-0 w-6 h-6 mb-1">
          {message.sender?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.sender.avatar_url}
              alt={message.sender.full_name}
              className="w-6 h-6 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center border border-gray-200">
              <span className="text-xs font-semibold text-gray-600">
                {message.sender?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col max-w-[75%] min-w-0">
        {!isOwnMessage && (
          <div className="flex items-center gap-2 px-1 mb-0.5">
            <span className="text-xs font-semibold text-gray-700">
              {message.sender.full_name}
            </span>
          </div>
        )}
        <div
          className={`relative px-3 py-2 rounded-2xl text-sm transition-all duration-200 ${
            isOwnMessage
              ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-br-md shadow-lg"
              : "bg-white text-gray-900 rounded-bl-md border border-gray-200 shadow-sm"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <div className={`flex items-center gap-1.5 mt-1.5 ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}>
            <span className={`text-[10px] ${
              isOwnMessage ? "text-white/70" : "text-gray-500"
            }`}>
              {formatMessageTime(message.sentAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

