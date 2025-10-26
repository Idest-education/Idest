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

    useEffect(() => {
        conversationService
            .getUserConversations()
            .then((res) => setConversations(res.items))
            .finally(() => setLoading(false));
    }, []);

    if (loading)
        return (
            <div className="flex items-center justify-center h-full py-10">
                <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );

    if (!conversations || conversations.length === 0) {
        return <p>No conversations yet.</p>;
    }

    if (conversations.length === 0)
        return <p className="text-gray-400 italic">No conversations yet.</p>;

    return (
        <div className="space-y-2">
            {conversations.map((c) => (
                <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className="w-full text-left p-4 bg-white rounded-xl border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                >
                    <p className="font-semibold text-gray-800">{c.title || "Untitled"}</p>
                    <p className="text-sm text-gray-500">{c.participants.length} participants</p>
                </button>
            ))}
        </div>
    );
}
