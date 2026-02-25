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
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
    const [loadingMore, setLoadingMore] = useState(false);

    const currentUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

    const loadConversations = () => {
        setLoading(true);
        conversationService
            .getUserConversations({ limit: 20 })
            .then((res) => {
                setConversations(res.items);
                setNextCursor(res.nextCursor || undefined);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadConversations();
    }, []);

    const loadMore = async () => {
        if (!nextCursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const res = await conversationService.getUserConversations({ cursor: nextCursor, limit: 20 });
            setConversations((prev) => {
                const ids = new Set(prev.map((c) => c.id));
                const merged = [...prev, ...res.items.filter((c) => !ids.has(c.id))];
                return merged;
            });
            setNextCursor(res.nextCursor || undefined);
        } finally {
            setLoadingMore(false);
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
            {conversations.map((c) => {
                const other = c.participants.find((p) => p.userId !== currentUserId);
                const displayName = c.isGroup
                    ? (c.title || "Cuộc trò chuyện")
                    : (other?.user.full_name || "Direct message");

                const lastMessage = c.messages?.[0];

                return (
                    <div
                        key={c.id}
                        className="bg-white rounded-xl border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                    >
                        <button
                            onClick={() => onSelect(c.id)}
                            className="w-full text-left p-4"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold text-gray-800 truncate">{displayName}</p>
                                {c._count?.messages !== undefined && (
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                        {c._count.messages} msgs
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                                {lastMessage ? lastMessage.content : "Chưa có tin nhắn nào"}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {c.participants.length} người tham gia
                            </p>
                        </button>
                    </div>
                );
            })}

            {nextCursor && (
                <div className="pt-2 flex justify-center">
                    <button
                        type="button"
                        disabled={loadingMore}
                        onClick={loadMore}
                        className="text-sm bg-gray-900 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                    >
                        {loadingMore ? "Loading..." : "Load more"}
                    </button>
                </div>
            )}
        </div>
    );
}
