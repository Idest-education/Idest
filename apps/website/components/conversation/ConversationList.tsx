"use client";

import { useEffect, useState } from "react";
import { conversationService } from "@/services/conversation.service";
import { ConversationDto } from "@/types/conversation";

interface ConversationListProps {
    onSelect: (conversationId: string) => void;
}

export default function ConversationList({ onSelect }: ConversationListProps) {
    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [loading, setLoading] = useState(true);

    const loadConversations = () => {
        conversationService
            .getUserConversations()
            .then((res) => setConversations(res.items))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadConversations();
    }, []);

    const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering onSelect
        if (!confirm("Xóa cuộc hội thoại này? Hành động này không thể hoàn tác.")) return;
        
        try {
            await conversationService.deleteConversation(conversationId);
            // Remove from local state
            setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        } catch (error) {
            console.error("Delete conversation failed:", error);
            alert("Không thể xóa cuộc hội thoại");
        }
    };

    if (loading)
        return (
            <div className="flex items-center justify-center h-full py-10">
                <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );

    if (!conversations || conversations.length === 0) {
        return <p>Chưa có cuộc hội thoại nào.</p>;
    }

    if (conversations.length === 0)
        return <p className="text-gray-400 italic">Chưa có cuộc hội thoại nào.</p>;

    return (
        <div className="space-y-2">
            {conversations.map((c) => (
                <div
                    key={c.id}
                    className="relative group bg-white rounded-xl border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                >
                    <button
                        onClick={() => onSelect(c.id)}
                        className="w-full text-left p-4"
                    >
                        <p className="font-semibold text-gray-800">{c.title || "Chưa có tiêu đề"}</p>
                        <p className="text-sm text-gray-500">{c.participants.length} người tham gia</p>
                    </button>
                    <button
                        onClick={(e) => handleDeleteConversation(c.id, e)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 text-xs"
                        title="Xóa cuộc hội thoại"
                    >
                        Xóa
                    </button>
                </div>
            ))}
        </div>
    );
}
