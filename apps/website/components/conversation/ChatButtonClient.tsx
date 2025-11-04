"use client";

import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import ConversationPopup from "@/components/conversation/ConversationPopup";
import { createPortal } from "react-dom";

export default function ChatButtonClient() {
    const [showList, setShowList] = useState(false);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);

    // thêm cờ kiểm tra để render mini-chat sau khi DOM mount
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <>
            {/* Nút chat trong Navbar */}
            <div className="relative">
                <button
                    onClick={() => setShowList((prev) => !prev)}
                    className="p-2 rounded-full hover:bg-indigo-50 transition relative"
                >
                    <MessageSquare className="w-6 h-6 text-indigo-600" />
                </button>

                {/* Popup danh sách hội thoại (dropdown trong navbar) */}
                {showList && (
                    <div className="absolute top-12 right-0 z-[9999]">
                        <ConversationPopup
                            onClose={() => setShowList(false)}
                            onSelectConversation={(id) => {
                                setActiveConversationId(id);
                                setShowList(false);
                                setDisplayName(displayName);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Mini ChatWindow popup render global (fixed trên toàn màn hình) */}
            {mounted && activeConversationId &&
                createPortal(
                    <div className="fixed bottom-6 right-6 z-[10000]">
                        <ConversationPopup
                            onClose={() => setActiveConversationId(null)}
                            defaultConversationId={activeConversationId}
                            receiverName={displayName!}
                        />
                    </div>,
                    document.body
                )
            }
        </>
    );
}
