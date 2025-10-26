"use client";

import { MessageDto } from "@/types/conversation";

interface MessageBubbleProps {
    message: MessageDto;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
    if (!message?.content?.trim()) return null;

    // Lấy user id của bạn từ localStorage (backend user id)
    const currentUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

    const isMine = message.senderId === currentUserId;

    return (
        <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[70%] px-4 py-2 rounded-xl text-sm ${isMine
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-gray-200 text-gray-800 rounded-bl-none"
                    }`}
            >
                {message.content}
            </div>
        </div>
    );
}
