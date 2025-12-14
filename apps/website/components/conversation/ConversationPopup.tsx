"use client";

import { useState, useEffect } from "react";
import { conversationService } from "@/services/conversation.service";
import { ConversationDto } from "@/types/conversation";
import ChatWindow from "./ChatWindow";
import { X } from "lucide-react";
import { socket, connectSocket } from "@/lib/socket";

interface ConversationPopupProps {
    onClose: () => void;
    onSelectConversation?: (conversationId: string, displayName: string) => void; // 👈 callback khi chọn hội thoại
    defaultConversationId?: string; // 👈 dùng khi hiển thị ChatWindow mini
    receiverName?: string;
}

export default function ConversationPopup({
    onClose,
    onSelectConversation,
    defaultConversationId,
    receiverName
}: ConversationPopupProps) {
    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(defaultConversationId ?? null);
    const [loading, setLoading] = useState(true);
    const currentUserId = localStorage.getItem("user_id");

    // Nếu có defaultConversationId thì mở luôn ChatWindow
    useEffect(() => {
        if (defaultConversationId) setSelectedId(defaultConversationId);
    }, [defaultConversationId]);

    useEffect(() => {
        conversationService
            .getUserConversations()
            .then((res) => setConversations(res.items))
            .finally(() => setLoading(false));

        // Connect socket and listen for real-time updates
        const token = localStorage.getItem("access_token");
        if (token) {
            connectSocket(token);

            // Listen for new conversations
            socket.on("conversation-created", (conversation: ConversationDto) => {
                setConversations((prev) => {
                    if (prev.find((c) => c.id === conversation.id)) return prev;
                    return [conversation, ...prev];
                });
            });

            // Listen for deleted conversations
            socket.on("conversation-deleted", (data: { conversationId: string }) => {
                setConversations((prev) => prev.filter((c) => c.id !== data.conversationId));
                // Close chat window if deleted conversation is currently open
                if (selectedId === data.conversationId) {
                    setSelectedId(null);
                }
            });
        }

        return () => {
            socket.off("conversation-created");
            socket.off("conversation-deleted");
        };
    }, [selectedId]);

    // Nếu popup được dùng để hiển thị ChatWindow mini
    if (defaultConversationId) {
        return (
            <div className="w-[380px] bg-white border border-indigo-100 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                <div className="flex justify-between items-center px-4 py-3 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <span className="font-semibold text-lg truncate">{receiverName}</span>
                    <button
                        onClick={onClose}
                        className="text-sm hover:bg-white/20 rounded-lg px-2 py-1"
                    >
                        ✕
                    </button>
                </div>
                <ChatWindow conversationId={selectedId!} onBack={onClose} />
            </div>
        );
    }

    // Nếu popup dùng để hiển thị danh sách hội thoại (navbar)
    return (
        <div className="w-[380px] bg-white border border-indigo-100 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <h3 className="font-semibold text-lg">Tin nhắn</h3>
                <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Danh sách hội thoại */}
            <div className="max-h-[500px] overflow-y-auto p-3 space-y-2">
                {loading && <p className="text-gray-500 text-sm">Đang tải...</p>}
                {!loading && conversations.length === 0 && (
                    <p className="text-gray-400 text-sm italic">Chưa có cuộc hội thoại nào.</p>
                )}

                {conversations.map((conv) => {
                    // Lấy participant còn lại
                    const other = conv.participants.find(
                        (p) => p.userId !== currentUserId
                    );

                    const displayName = conv.isGroup
                        ? (conv.title || "Cuộc trò chuyện chưa có tên")
                        : (other?.user.full_name || "Người dùng không xác định");

                    return (
                        <button
                            key={conv.id}
                            onClick={() => onSelectConversation?.(conv.id, displayName)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 transition"
                        >
                            <p className="font-semibold text-gray-800">
                                {displayName}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                                {conv.messages?.at(-1)?.content || "Chưa có tin nhắn nào"}
                            </p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
