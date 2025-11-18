"use client";

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessageResponse, MessageHistoryResponse } from "@/types/meet";
import Image from "next/image";
import DefaultAvatar from "@/assets/default-avatar.png";

interface MeetingChatProps {
  messages: ChatMessageResponse[];
  messageHistory: MessageHistoryResponse[];
  onSendMessage: (message: string) => void;
}

export default function MeetingChat({
  messages,
  messageHistory,
  onSendMessage,
}: MeetingChatProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Combine message history and real-time messages
  const allMessages = [...messageHistory.map(convertHistoryToChat), ...messages];

  // Sort by timestamp
  const sortedMessages = allMessages.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [sortedMessages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue("");
    }
  };

  const formatTime = (timestamp: string | Date) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Chat</h3>
      </div>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {sortedMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          sortedMessages.map((message, index) => (
            <div key={`${message.userId}-${message.timestamp}-${index}`} className="flex gap-3">
              <div className="flex-shrink-0 relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                <Image
                  src={message.userAvatar || DefaultAvatar}
                  alt={message.userFullName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-gray-900">
                    {message.userFullName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 break-words">{message.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!inputValue.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// Helper function to convert message history to chat message format
function convertHistoryToChat(
  msg: MessageHistoryResponse
): ChatMessageResponse {
  return {
    sessionId: "",
    message: msg.content,
    userId: msg.sender.id,
    userFullName: msg.sender.full_name,
    userAvatar: msg.sender.avatar_url || undefined,
    timestamp: msg.sentAt,
  };
}

