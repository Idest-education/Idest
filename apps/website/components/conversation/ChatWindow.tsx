"use client";

import { useEffect, useRef, useState } from "react";
import { conversationService } from "@/services/conversation.service";
import { MessageDto, TypingStatusDto, MessageReadStatus } from "@/types/conversation";
import MessageBubble from "./MessageBubble";
import { socket, connectSocket } from "@/lib/socket";

interface ChatWindowProps {
    conversationId: string;
    onBack: () => void;
}

export default function ChatWindow({ conversationId }: ChatWindowProps) {
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [typingUsers, setTypingUsers] = useState<TypingStatusDto[]>([]);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        if (!token) {
            console.warn("No access token found for socket connection");
            return;
        }

        connectSocket(token);
        
        socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
            socket.emit("join-conversation", { conversationId });
        });

        socket.on("disconnect", () => {
            console.log("Socket disconnected");
        });

        socket.on("join-conversation-success", (data) => {
            console.log("Joined conversation:", data);
        });

        socket.on("join-conversation-error", (error) => {
            console.error("Failed to join conversation:", error);
        });

        // If already connected, join immediately
        if (socket.connected) {
            socket.emit("join-conversation", { conversationId });
        }

        socket.on("message-new", (msg: MessageDto) => {
            console.log("Received new message:", msg);
            setMessages((prev) => {
                // Check if message already exists
                if (prev.find((m) => m.id === msg.id)) {
                    console.log("Message already exists, skipping:", msg.id);
                    return prev;
                }
                console.log("Adding new message to list:", msg.id);
                return [...prev, msg];
            });
        });

        socket.on("user-typing-status", (data: TypingStatusDto) => {
            if (data.conversationId === conversationId) {
                setTypingUsers((prev) => {
                    const filtered = prev.filter((u) => u.userId !== data.userId);
                    return data.isTyping ? [...filtered, data] : filtered;
                });
            }
        });

        socket.on("message-edited", (msg: MessageDto) => {
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        });

        socket.on("message-deleted", (data: { messageId: string; conversationId: string }) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === data.messageId
                        ? { ...m, isDeleted: true, content: "Tin nhắn đã bị xóa" }
                        : m
                )
            );
        });

        socket.on("message-read-status", (data: MessageReadStatus) => {
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id === data.messageId) {
                        return { ...m, readBy: [...(m.readBy || []), data.userId] };
                    }
                    return m;
                })
            );
        });

        return () => {
            console.log("Cleaning up conversation:", conversationId);
            socket.emit("leave-conversation", conversationId);
            socket.off("connect");
            socket.off("disconnect");
            socket.off("join-conversation-success");
            socket.off("join-conversation-error");
            socket.off("message-new");
            socket.off("user-typing-status");
            socket.off("message-edited");
            socket.off("message-deleted");
            socket.off("message-read-status");
        };
    }, [conversationId]);

    // Tự động scroll xuống cuối khi có tin nhắn mới
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "auto" });
    }, [messages]);

    // Gửi tin nhắn
    const handleSend = async () => {
        if (!content.trim()) return;
        
        const messageContent = content;
        setContent(""); // Clear input immediately for better UX
        
        try {
            console.log("Sending message:", messageContent);
            const result = await conversationService.sendMessage(conversationId, { content: messageContent });
            console.log("Message sent successfully:", result);
            // Don't add message here - let the socket "message-new" event handle it
            // This ensures consistency across all clients
            
            // Stop typing indicator
            socket.emit("user-typing", { conversationId, isTyping: false });
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        } catch (error) {
            console.error("Send failed:", error);
            // Restore content on error
            setContent(messageContent);
            alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
        }
    };

    // Xử lý typing indicator
    const handleInputChange = (value: string) => {
        setContent(value);

        // Emit typing event
        socket.emit("user-typing", { conversationId, isTyping: true });

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("user-typing", { conversationId, isTyping: false });
        }, 2000);
    };

    // Chỉnh sửa tin nhắn
    const handleEditMessage = async (messageId: string) => {
        if (!editContent.trim()) return;
        try {
            await conversationService.editMessage(conversationId, messageId, { content: editContent });
            setEditingMessageId(null);
            setEditContent("");
        } catch (error) {
            console.error("Edit failed:", error);
        }
    };

    // Xóa tin nhắn
    const handleDeleteMessage = async (messageId: string) => {
        if (!confirm("Xóa tin nhắn này?")) return;
        try {
            await conversationService.deleteMessage(conversationId, messageId);
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    // Bắt đầu edit
    const handleStartEdit = (message: MessageDto) => {
        setEditingMessageId(message.id);
        setEditContent(message.content);
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
                            <MessageBubble 
                                key={m.id ?? i} 
                                message={m}
                                onEdit={handleStartEdit}
                                onDelete={handleDeleteMessage}
                            />
                        ))}
                        {typingUsers.length > 0 && (
                            <div className="text-sm text-gray-500 italic px-4 py-2">
                                {typingUsers.map((u) => u.userName).join(", ")}{" "}
                                {typingUsers.length > 1 ? "are" : "is"} typing...
                            </div>
                        )}
                        <div ref={endOfMessagesRef}></div>
                    </>
                )}
            </div>

            {editingMessageId ? (
                <div className="flex gap-2 p-3 border-t bg-yellow-50">
                    <div className="flex-1">
                        <p className="text-xs text-gray-600 mb-1">Editing message</p>
                        <input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            placeholder="Chỉnh sửa tin nhắn của bạn..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleEditMessage(editingMessageId);
                                }
                                if (e.key === "Escape") {
                                    setEditingMessageId(null);
                                    setEditContent("");
                                }
                            }}
                        />
                    </div>
                    <button
                        onClick={() => handleEditMessage(editingMessageId)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all"
                    >
                        Save
                    </button>
                    <button
                        onClick={() => {
                            setEditingMessageId(null);
                            setEditContent("");
                        }}
                        className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                <div className="flex gap-2 p-3 border-t">
                    <input
                        value={content}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder="Nhập tin nhắn..."
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
            )}
        </div>
    );
}
