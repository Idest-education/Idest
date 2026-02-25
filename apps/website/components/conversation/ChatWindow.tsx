"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { conversationService } from "@/services/conversation.service";
import type { AttachmentDto, MessageDto } from "@/types/conversation";
import MessageBubble from "./MessageBubble";
import DateSeparator from "./DateSeparator";
import TypingIndicator from "./TypingIndicator";
import MessageSearch from "./MessageSearch";
import { socket, connectSocket } from "@/lib/socket";
import { createClient } from "@/lib/supabase/client";
import { Paperclip, ArrowDown, Loader2, Search } from "lucide-react";
import { groupMessages } from "@/lib/utils/message-grouping";

interface ChatWindowProps {
    conversationId: string;
    onBack: () => void;
}

export default function ChatWindow({ conversationId }: ChatWindowProps) {
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [replyTo, setReplyTo] = useState<MessageDto | null>(null);

    const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
    const isNearBottomRef = useRef(true);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [pendingMessages, setPendingMessages] = useState<Map<string, MessageDto>>(new Map());
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const [editingMessage, setEditingMessage] = useState<MessageDto | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const canSend = useMemo(() => {
        return content.trim().length > 0 || attachments.length > 0;
    }, [content, attachments.length]);

    // Group messages for better UI
    const groupedMessages = useMemo(() => {
        return groupMessages(messages);
    }, [messages]);

    // Load tin nhắn ban đầu
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setMessages([]);
        setHasMore(false);

        conversationService
            .getMessages(conversationId, { limit: 50 })
            .then((res) => {
                if (cancelled) return;
                setMessages(res.messages);
                setHasMore(res.hasMore);
                scrollToBottom(false);
            })
            .finally(() => {
                if (cancelled) return;
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [conversationId]);

    const loadOlderMessages = useCallback(async () => {
        if (loading || loadingOlder || !hasMore) return;
        const oldest = messages[0];
        if (!oldest?.sentAt) return;

        const container = scrollContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;
        const prevScrollTop = container?.scrollTop ?? 0;

        setLoadingOlder(true);
        try {
            const res = await conversationService.getMessages(conversationId, {
                limit: 50,
                before: new Date(oldest.sentAt),
            });

            setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const toPrepend = res.messages.filter((m) => !existingIds.has(m.id));
                return [...toPrepend, ...prev];
            });
            setHasMore(res.hasMore);

            requestAnimationFrame(() => {
                const nextScrollHeight = container?.scrollHeight ?? 0;
                if (container) {
                    container.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
                }
            });
        } finally {
            setLoadingOlder(false);
        }
    }, [conversationId, hasMore, loading, loadingOlder, messages]);

    // Kết nối socket và lắng nghe realtime
    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            console.warn("No access token found for socket connection");
            return;
        }

        connectSocket(token);
        
        const handleConnected = () => {
            socket.emit("join-conversation", { conversationId });
        };

        const handleNewMessage = (msg: MessageDto) => {
            // Safety: only append messages for this conversation
            if (msg.conversationId && msg.conversationId !== conversationId) return;
            
            // Remove from pending if it was a pending message
            setPendingMessages((prev) => {
                const newMap = new Map(prev);
                newMap.delete(msg.id);
                return newMap;
            });
            
            setMessages((prev) => {
                if (prev.find((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });

            if (isNearBottomRef.current) {
                scrollToBottom(false);
            }
        };

        socket.on("connect", handleConnected);

        // If already connected, join immediately
        if (socket.connected) {
            socket.emit("join-conversation", { conversationId });
        }

        socket.on("message-new", handleNewMessage);

        // Handle typing indicators
        const handleTyping = (data: { userId: string; userName: string; conversationId: string }) => {
            if (data.conversationId !== conversationId) return;
            
            setTypingUsers((prev) => {
                const newSet = new Set(prev);
                newSet.add(data.userName);
                return newSet;
            });

            // Clear typing after 3 seconds
            const timeoutId = setTimeout(() => {
                setTypingUsers((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(data.userName);
                    return newSet;
                });
                typingTimeoutRef.current.delete(data.userName);
            }, 3000);

            // Clear existing timeout
            const existingTimeout = typingTimeoutRef.current.get(data.userName);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }
            typingTimeoutRef.current.set(data.userName, timeoutId);
        };

        socket.on("user-typing", handleTyping);

        return () => {
            socket.emit("leave-conversation", conversationId);
            socket.off("connect", handleConnected);
            socket.off("message-new", handleNewMessage);
            socket.off("user-typing", handleTyping);
            
            // Clear all typing timeouts
            typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
            typingTimeoutRef.current.clear();
        };
    }, [conversationId]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // mark "near bottom" to decide auto-scroll on incoming messages
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        isNearBottomRef.current = distanceToBottom < 100;
        
        // Show/hide scroll to bottom button
        setShowScrollToBottom(distanceToBottom > 200);

        // load older when user scrolls to top
        if (container.scrollTop < 20) {
            loadOlderMessages();
        }
    }, [loadOlderMessages]);

    const scrollToBottom = useCallback((smooth = true) => {
        requestAnimationFrame(() => {
            endOfMessagesRef.current?.scrollIntoView({ 
                behavior: smooth ? "smooth" : "auto",
                block: "end"
            });
        });
    }, []);

    // Gửi tin nhắn
    const handleSend = async () => {
        if (!canSend) return;
        
        const messageContent = content;
        const messageReplyToId = replyTo?.id;
        const messageAttachments = attachments;
        const isEditing = editingMessage !== null;

        setContent("");
        setReplyTo(null);
        setAttachments([]);
        setEditingMessage(null);
        
        try {
            const contentToSend =
                messageContent.trim() ||
                messageAttachments.find((a) => a?.filename)?.filename ||
                "Attachment";

            // TODO: If editing, call update message API instead
            if (isEditing) {
                // For now, just send as new message
                // await conversationService.updateMessage(conversationId, editingMessage.id, { content: contentToSend });
            }

            const result = await conversationService.sendMessage(conversationId, {
                content: contentToSend,
                replyToId: messageReplyToId,
                attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
            });

            // Add to pending messages with sending status
            setPendingMessages((prev) => {
                const newMap = new Map(prev);
                newMap.set(result.id, { ...result, status: "sending" } as any);
                return newMap;
            });

            // If socket is disconnected, fall back to optimistic append.
            if (!socket.connected) {
                setMessages((prev) => {
                    if (prev.find((m) => m.id === result.id)) return prev;
                    return [...prev, result];
                });
                setPendingMessages((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(result.id);
                    return newMap;
                });
                scrollToBottom(false);
            }
        } catch (error) {
            console.error("Send failed:", error);
            // Restore on error
            setContent(messageContent);
            setReplyTo(replyTo);
            setAttachments(messageAttachments);
            alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
        }
    };

    const handlePickFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (file: File) => {
        const supabase = createClient();
        const bucket = process.env.NEXT_PUBLIC_CHAT_FILES_BUCKET || "avatars";
        const currentUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

        const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
        const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
        const path = `chat/${conversationId}/${currentUserId || "user"}/${uuid}-${safeName}`;

        setUploading(true);
        try {
            const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
                upsert: false,
                contentType: file.type || undefined,
            });
            if (uploadError) throw uploadError;

            const {
                data: { publicUrl },
            } = supabase.storage.from(bucket).getPublicUrl(path);

            setAttachments((prev) => [
                ...prev,
                {
                    type: file.type || "file",
                    url: publicUrl,
                    filename: file.name,
                    size: file.size,
                },
            ]);
        } catch (e) {
            console.error(e);
            alert("Không thể tải file lên. Vui lòng thử lại.");
        } finally {
            setUploading(false);
        }
    };

    const handleSelectSearchResult = useCallback((messageId: string) => {
        const messageElement = messageRefs.current.get(messageId);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
            messageElement.classList.add("ring-2", "ring-orange-500", "ring-offset-2", "rounded-lg");
            setTimeout(() => {
                messageElement.classList.remove("ring-2", "ring-orange-500", "ring-offset-2", "rounded-lg");
            }, 2000);
        }
        setShowSearch(false);
    }, []);

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
            {showSearch && (
                <MessageSearch
                    messages={messages}
                    onSelectMessage={handleSelectSearchResult}
                    onClose={() => setShowSearch(false)}
                />
            )}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-gray-50/50 to-white scroll-smooth"
                style={{ scrollBehavior: "smooth" }}
                role="log"
                aria-label="Message list"
                aria-live="polite"
                aria-atomic="false"
            >
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3" role="status" aria-live="polite">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" aria-hidden="true" />
                        <p className="text-sm text-gray-500">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 animate-fadeIn" role="status" aria-live="polite">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center" aria-hidden="true">
                            <svg
                                className="w-8 h-8 text-orange-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900 mb-1">No messages yet</p>
                            <p className="text-sm text-gray-500">Start the conversation by sending a message</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {loadingOlder && (
                            <div className="flex items-center justify-center py-3 animate-fadeIn" role="status" aria-live="polite">
                                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" aria-label="Loading older messages" />
                            </div>
                        )}
                        {groupedMessages.map((grouped, i) => {
                            const prevGrouped = i > 0 ? groupedMessages[i - 1] : null;
                            const showSeparator = grouped.showDateSeparator || 
                                (prevGrouped && prevGrouped.message.sentAt !== grouped.message.sentAt);

                            return (
                                <div 
                                    key={grouped.message.id ?? i}
                                    ref={(el) => {
                                        if (el && grouped.message.id) {
                                            messageRefs.current.set(grouped.message.id, el);
                                        }
                                    }}
                                >
                                    {grouped.showDateSeparator && (
                                        <DateSeparator date={grouped.message.sentAt} />
                                    )}
                                    <MessageBubble
                                        groupedMessage={grouped}
                                        onReply={() => setReplyTo(grouped.message)}
                                        replyPreview={
                                            grouped.message.replyToId
                                                ? messages.find((x) => x.id === grouped.message.replyToId) ?? null
                                                : null
                                        }
                                        status={
                                            pendingMessages.has(grouped.message.id)
                                                ? "sending"
                                                : grouped.message.senderId === (typeof window !== "undefined" ? localStorage.getItem("user_id") : null)
                                                ? "sent"
                                                : undefined
                                        }
                                        onEdit={(msg) => {
                                            setEditingMessage(msg);
                                            setContent(msg.content);
                                            setReplyTo(null);
                                        }}
                                        onDelete={async (messageId) => {
                                            // TODO: Implement delete API call
                                            setMessages((prev) => prev.filter((m) => m.id !== messageId));
                                        }}
                                        onCopy={(text) => {
                                            navigator.clipboard.writeText(text);
                                        }}
                                        onForward={(msg) => {
                                            // TODO: Implement forward functionality
                                            console.log("Forward message:", msg);
                                        }}
                                        onReact={(messageId, emoji) => {
                                            // TODO: Implement reaction API call
                                            console.log("React to message:", messageId, emoji);
                                        }}
                                    />
                                </div>
                            );
                        })}
                        {typingUsers.size > 0 && (
                            <TypingIndicator users={Array.from(typingUsers)} />
                        )}
                        <div ref={endOfMessagesRef} className="h-1" />
                    </>
                )}
            </div>

            {/* Scroll to bottom button */}
            {showScrollToBottom && (
                <button
                    onClick={() => scrollToBottom(true)}
                    className="absolute bottom-20 right-4 sm:right-6 z-10 p-3 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation min-w-[44px] min-h-[44px]"
                    aria-label="Scroll to bottom"
                    title="Scroll to bottom"
                >
                    <ArrowDown className="w-5 h-5 text-gray-700" />
                </button>
            )}

            <div className="border-t bg-white flex-shrink-0">
                {/* Search button */}
                <div className="px-3 pt-2 flex justify-end">
                    <button
                        type="button"
                        onClick={() => setShowSearch(!showSearch)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Search messages"
                        aria-label="Search messages"
                    >
                        <Search className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                {replyTo && (
                    <div className="px-3 pt-3 animate-slideDown">
                        <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                            <div className="min-w-0">
                                <p className="text-xs text-orange-700 font-medium">Replying to</p>
                                <p className="text-sm text-gray-700 truncate">
                                    {replyTo.sender?.full_name ? `${replyTo.sender.full_name}: ` : ""}
                                    {replyTo.content}
                                </p>
                            </div>
                            <button
                                onClick={() => setReplyTo(null)}
                                className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 transition-colors"
                                type="button"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {attachments.length > 0 && (
                    <div className="px-3 pt-3 flex flex-wrap gap-2">
                        {attachments.map((a, idx) => (
                            <span
                                key={`${a.url ?? "att"}-${idx}`}
                                className="inline-flex items-center gap-2 text-xs bg-gray-100 border border-gray-200 rounded-full px-3 py-1"
                            >
                                <span className="truncate max-w-[220px]">{a.filename || a.url || "attachment"}</span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setAttachments((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    className="text-gray-600 hover:text-gray-900"
                                    aria-label="Remove attachment"
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex gap-2 p-2 sm:p-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelected(file);
                            e.target.value = "";
                        }}
                        aria-label="Attach file"
                    />
                    <button
                        type="button"
                        onClick={handlePickFile}
                        disabled={uploading}
                        className="inline-flex items-center justify-center w-11 h-11 sm:w-11 sm:h-11 rounded-xl border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition disabled:opacity-50 touch-manipulation"
                        title="Attach file"
                        aria-label="Attach file"
                    >
                        <Paperclip className="w-5 h-5 text-gray-700" />
                    </button>
                    <input
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            // Emit typing indicator
                            if (socket.connected && e.target.value.trim().length > 0) {
                                socket.emit("typing", { conversationId });
                            }
                        }}
                        placeholder={editingMessage ? "Edit message..." : "Nhập tin nhắn..."}
                        className="flex-1 border border-gray-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all text-sm"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                            if (e.key === "Escape" && editingMessage) {
                                setEditingMessage(null);
                                setContent("");
                                setReplyTo(null);
                            }
                        }}
                        aria-label={editingMessage ? "Edit message" : "Type a message"}
                    />
                    {editingMessage && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingMessage(null);
                                setContent("");
                                setReplyTo(null);
                            }}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 active:text-gray-700 transition-colors touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                            aria-label="Cancel editing"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSend}
                        disabled={!canSend}
                        className="bg-orange-500 disabled:bg-orange-300 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl hover:bg-orange-600 active:bg-orange-700 transition-all text-sm font-medium shadow-md hover:shadow-lg disabled:shadow-none touch-manipulation min-w-[60px] sm:min-w-0"
                        aria-label={uploading ? "Uploading" : editingMessage ? "Save changes" : "Send message"}
                    >
                        {uploading ? "Uploading..." : editingMessage ? "Save" : "Send"}
                    </button>
                </div>
            </div>
        </div>
    );
}
