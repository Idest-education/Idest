"use client";

import { useEffect, useRef, useState } from "react";
import { conversationService } from "@/services/conversation.service";
import { MessageDto } from "@/types/conversation";
import MessageBubble from "./MessageBubble";
import { socket, connectSocket } from "@/lib/socket";

interface ChatWindowProps {
    conversationId: string;
    onBack: () => void;
}

export default function ChatWindow({ conversationId, onBack }: ChatWindowProps) {
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

    // Load tin nhắn ban đầu
    useEffect(() => {
        conversationService
            .getMessages(conversationId)
            .then((res) => setMessages(res.messages))
            .finally(() => setLoading(false));
    }, [conversationId]);

    // Kết nối socket và lắng nghe realtime
    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        connectSocket(token);
        socket.emit("join-conversation", { conversationId });

        socket.on("message-new", (msg: MessageDto) => {
            setMessages((prev) => {
                if (prev.find((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        });

        return () => {
            socket.emit("leave-conversation", conversationId);
            socket.off("message-new");
        };
    }, [conversationId]);

    // ✅ Tự động scroll xuống cuối khi có tin nhắn mới
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "auto" });
    }, [messages]);

    // Gửi tin nhắn
    const handleSend = async () => {
        if (!content.trim()) return;
        try {
            const newMsg = await conversationService.sendMessage(conversationId, { content });
            setMessages((prev) => [...prev, newMsg]);
            setContent("");
        } catch (error) {
            console.error("Send failed:", error);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-white rounded-2xl border border-indigo-100 shadow-lg">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <p className="text-gray-400 italic text-center">No messages yet.</p>
                ) : (
                    <>
                        {messages.map((m, i) => (
                            <MessageBubble key={m.id ?? i} message={m} />
                        ))}
                        <div ref={endOfMessagesRef}></div>
                    </>
                )}
            </div>

            <div className="flex gap-2 p-3 border-t">
                <input
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />
                <button
                    onClick={handleSend}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all"
                >
                    Send
                </button>
            </div>
        </div>
    );
}
