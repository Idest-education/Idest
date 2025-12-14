"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import ConversationPopup from "@/components/conversation/ConversationPopup";
import { createPortal } from "react-dom";
import { connectSocket, socket } from "@/lib/socket";
import type { MessageDto } from "@/types/conversation";

export default function ChatButtonClient() {
    const [open, setOpen] = useState(false);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [activeConversationName, setActiveConversationName] = useState<string | null>(null);

    const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>([]);
    const unreadSet = useMemo(() => new Set(unreadConversationIds), [unreadConversationIds]);
    const hasUnread = unreadConversationIds.length > 0;

    // thêm cờ kiểm tra để render mini-chat sau khi DOM mount
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const currentUserId =
        typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

    const audioUnlockedRef = useRef(false);
    const unlockAudio = async () => {
        if (audioUnlockedRef.current) return;
        try {
            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            await ctx.resume();
            await ctx.close();
            audioUnlockedRef.current = true;
        } catch {
            // ignore
        }
    };

    const playNotificationBeep = () => {
        try {
            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = 880;
            g.gain.value = 0.02;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.12);
            o.onended = () => {
                ctx.close().catch(() => void 0);
            };
        } catch {
            // ignore
        }
    };

    // Connect socket once + handle global notifications/unread
    useEffect(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        if (!token) return;
        connectSocket(token);

        const onNewMessage = (msg: MessageDto) => {
            const convId = msg.conversationId;
            if (!convId) return;
            if (currentUserId && msg.senderId === currentUserId) return;

            const isViewingThisConversation = open && activeConversationId === convId;
            if (!isViewingThisConversation) {
                setUnreadConversationIds((prev) => {
                    if (prev.includes(convId)) return prev;
                    return [convId, ...prev];
                });
                playNotificationBeep();
            }
        };

        socket.on("message-new", onNewMessage);
        return () => {
            socket.off("message-new", onNewMessage);
        };
    }, [activeConversationId, currentUserId, open]);

    const clearUnread = (conversationId: string) => {
        setUnreadConversationIds((prev) => prev.filter((id) => id !== conversationId));
    };

    return (
        <>
            {/* Nút chat trong Navbar */}
            <div className="relative">
                <button
                    onClick={async () => {
                        await unlockAudio();
                        setOpen((prev) => !prev);
                    }}
                    className="p-2 rounded-full hover:bg-orange-50 transition relative"
                >
                    <MessageSquare className="w-6 h-6 text-orange-500" />
                    {hasUnread && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                    )}
                </button>
            </div>

            {/* Side drawer conversation UI */}
            {mounted && open &&
                createPortal(
                    <div className="fixed inset-0 z-[10000]">
                        {/* Backdrop */}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fadeIn"
                            aria-label="Close chat"
                        />

                        {/* Drawer */}
                        <div className="absolute right-0 top-0 h-full w-[920px] max-w-[95vw] bg-white shadow-2xl border-l border-gray-200 animate-fadeIn">
                            <ConversationPopup
                                onClose={() => setOpen(false)}
                                activeConversationId={activeConversationId}
                                activeConversationName={activeConversationName}
                                onActiveConversationChange={(id, name) => {
                                    setActiveConversationId(id);
                                    setActiveConversationName(name ?? null);
                                    if (id) clearUnread(id);
                                }}
                                unreadConversationIds={Array.from(unreadSet)}
                                onClearUnread={clearUnread}
                            />
                        </div>
                    </div>,
                    document.body,
                )
            }
        </>
    );
}
