"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
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
    <div
      className="flex h-full w-full sm:w-80 flex-shrink-0 flex-col overflow-hidden rounded-lg shadow-sm"
      style={{ background: "#151515", borderLeft: "1px solid #2a2a2a" }}
    >
      <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: "#fffaf5" }}>Trò chuyện</span>
          {hasMoreMessages && (
            <Button variant="ghost" size="sm" onClick={loadOlder} disabled={isLoadingMessages}>
              Tải tin cũ hơn
            </Button>
          )}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 scroll-smooth"
        style={{ background: "#0b0b0b" }}
      >
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

      <form onSubmit={submit} className="flex-shrink-0 p-3" style={{ borderTop: "1px solid #2a2a2a" }}>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1"
            style={{ background: "rgba(255,250,245,0.07)", border: "1px solid #2a2a2a", color: "#fffaf5" }}
          />
          <button
            type="submit"
            className="h-9 rounded-md px-4 text-sm font-medium text-white"
            style={{ background: "var(--color-brand)" }}
          >
            Gửi
          </button>
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
              className="w-6 h-6 rounded-full object-cover"
              style={{ border: "1px solid #2a2a2a" }}
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "#2d1500", color: "#fffaf5", border: "1px solid #2a2a2a" }}
            >
              <span className="text-xs font-semibold">
                {message.sender?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col max-w-[75%] min-w-0">
        {!isOwnMessage && (
          <div className="flex items-center gap-2 px-1 mb-0.5">
            <span className="text-xs font-semibold" style={{ color: "rgba(255,250,245,0.7)" }}>
              {message.sender.full_name}
            </span>
          </div>
        )}
        <div
          className={`relative px-3 py-2 rounded-2xl text-sm transition-all duration-200 ${
            isOwnMessage
              ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-br-md shadow-lg"
              : "rounded-bl-md shadow-sm"
          }`}
          style={
            isOwnMessage
              ? undefined
              : { background: "#2d1500", color: "#fffaf5", border: "1px solid #2a2a2a" }
          }
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <div className={`flex items-center gap-1.5 mt-1.5 ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}>
            <span className={`text-[10px] ${
              isOwnMessage ? "text-white/70" : ""
            }`}
              style={isOwnMessage ? undefined : { color: "rgba(255,250,245,0.45)" }}
            >
              {formatMessageTime(message.sentAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
