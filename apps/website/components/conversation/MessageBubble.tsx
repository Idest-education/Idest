"use client";

import { MessageDto } from "@/types/conversation";
import { useState } from "react";

interface MessageBubbleProps {
    message: MessageDto;
    onEdit?: (message: MessageDto) => void;
    onDelete?: (messageId: string) => void;
}

export default function MessageBubble({ message, onEdit, onDelete }: MessageBubbleProps) {
    const [showActions, setShowActions] = useState(false);

    if (!message?.content?.trim()) return null;

    // Lấy user id của bạn từ localStorage (backend user id)
    const currentUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

    const isMine = message.senderId === currentUserId;
    const isDeleted = message.isDeleted;

    return (
        <div 
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div className="flex flex-col max-w-[70%] gap-1">
                <div
                    className={`px-4 py-2 rounded-xl text-sm ${
                        isDeleted
                            ? "bg-gray-100 text-gray-400 italic border border-gray-300"
                            : isMine
                            ? "bg-indigo-600 text-white rounded-br-none"
                            : "bg-gray-200 text-gray-800 rounded-bl-none"
                    }`}
                >
                    {isDeleted ? (
                        <p className="text-gray-400 italic">Tin nhắn đã bị xóa</p>
                    ) : (
                        <>
                            <p>{message.content}</p>
                            {message.editedAt && (
                                <span className="text-xs opacity-70 ml-2">(đã chỉnh sửa)</span>
                            )}
                        </>
                    )}
                </div>

                {/* Action buttons for own messages */}
                {!isDeleted && isMine && showActions && (onEdit || onDelete) && (
                    <div className="flex gap-2 justify-end">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(message)}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            >
                                Chỉnh sửa
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(message.id)}
                                className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                            >
                                Xóa
                            </button>
                        )}
                    </div>
                )}

                {/* Read receipts (optional - show checkmark if message has been read) */}
                {isMine && message.readBy && message.readBy.length > 0 && (
                    <div className="flex justify-end">
                        <span className="text-xs text-gray-500">
                            ✓✓ Đã đọc bởi {message.readBy.length}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
