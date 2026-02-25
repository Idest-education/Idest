"use client";

import type { MessageDto } from "@/types/conversation";
import { memo } from "react";
import { Reply, Check, CheckCheck, Clock } from "lucide-react";
import { formatMessageTime, formatFullTimestamp } from "@/lib/utils/date-format";
import type { GroupedMessage } from "@/lib/utils/message-grouping";
import MessageActions from "./MessageActions";
import MarkdownRenderer from "./MarkdownRenderer";
import AttachmentPreview from "./AttachmentPreview";

interface MessageBubbleProps {
    groupedMessage: GroupedMessage;
    onReply?: () => void;
    replyPreview?: MessageDto | null;
    status?: "sending" | "sent" | "delivered" | "read";
    onEdit?: (message: MessageDto) => void;
    onDelete?: (messageId: string) => void;
    onCopy?: (text: string) => void;
    onForward?: (message: MessageDto) => void;
    onReact?: (messageId: string, emoji: string) => void;
}


const MessageBubble = memo(function MessageBubble({ 
    groupedMessage, 
    onReply, 
    replyPreview, 
    status,
    onEdit,
    onDelete,
    onCopy,
    onForward,
    onReact,
}: MessageBubbleProps) {
    const { message, isFirstInGroup, showSenderInfo } = groupedMessage;

    if (!message?.content?.trim()) return null;

    const currentUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    const isMine = message.senderId === currentUserId;
    const attachments = message.attachments || [];

    // Status icon component
    const StatusIcon = () => {
        if (!isMine || !status) return null;
        
        const iconClass = `w-3.5 h-3.5 ${
            status === "read" ? "text-blue-500" : 
            status === "delivered" ? "text-gray-400" : 
            status === "sent" ? "text-gray-400" : 
            "text-gray-300"
        }`;

        if (status === "sending") {
            return <Clock className={iconClass} />;
        }
        if (status === "sent") {
            return <Check className={iconClass} />;
        }
        if (status === "delivered" || status === "read") {
            return <CheckCheck className={iconClass} />;
        }
        return null;
    };

    return (
        <div 
            className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"} group/message mb-4 animate-fadeIn`}
            role="article"
            aria-label={`Message from ${isMine ? "you" : message.sender?.full_name || "unknown"}`}
        >
            {/* Avatar for received messages - only show for first in group */}
            {!isMine && isFirstInGroup && (
                <div className="flex-shrink-0 w-8 h-8 mb-1">
                    {message.sender?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={message.sender.avatar_url}
                            alt={message.sender.full_name}
                            className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center border-2 border-gray-200">
                            <span className="text-xs font-semibold text-gray-600">
                                {message.sender?.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Spacer for alignment when no avatar */}
            {!isMine && !isFirstInGroup && <div className="flex-shrink-0 w-8" />}

            <div className="flex flex-col max-w-[85%] sm:max-w-[70%] min-w-0">
                {/* Sender name - only for first message in group from others */}
                {showSenderInfo && (
                    <div className="flex items-center gap-2 px-2 mb-0.5">
                        <span className="text-xs font-semibold text-gray-700">
                            {message.sender?.full_name}
                        </span>
                    </div>
                )}

                <div className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                    <div
                        className={`relative px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-sm transition-all duration-200 ${
                            isMine
                                ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-br-md shadow-lg hover:shadow-xl"
                                : "bg-white text-gray-900 rounded-bl-md border border-gray-200 shadow-sm hover:shadow-md"
                        }`}
                    >
                        {message.replyToId && (
                            <div className={`mb-2 rounded-lg px-3 py-2 border-l-2 ${
                                isMine 
                                    ? "bg-white/20 border-white/40" 
                                    : "bg-gray-50 border-orange-300"
                            }`}>
                                <p className={`text-xs ${isMine ? "text-white/90" : "text-gray-600"} font-medium mb-0.5`}>
                                    {replyPreview?.sender?.full_name ?? "Unknown"}
                                </p>
                                <p className={`text-xs ${isMine ? "text-white/80" : "text-gray-700"} line-clamp-2`}>
                                    {replyPreview?.content || "Message not loaded"}
                                </p>
                            </div>
                        )}

                        <div className="break-words">
                            <MarkdownRenderer content={message.content} />
                        </div>

                        {attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                                {attachments.map((att, idx) => {
                                    const key = `${att.url ?? "att"}-${idx}`;
                                    return (
                                        <AttachmentPreview
                                            key={key}
                                            attachment={att}
                                            isOwnMessage={isMine}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* Timestamp and status */}
                        <div className={`flex items-center gap-1.5 mt-1.5 ${
                            isMine ? "justify-end" : "justify-start"
                        }`}>
                            <span 
                                className={`text-[10px] ${
                                    isMine ? "text-white/70" : "text-gray-500"
                                }`}
                                title={formatFullTimestamp(message.sentAt)}
                            >
                                {formatMessageTime(message.sentAt)}
                            </span>
                            {isMine && <StatusIcon />}
                        </div>
                    </div>

                    {/* Reply button */}
                    {onReply && (
                        <button
                            type="button"
                            onClick={onReply}
                            className={`opacity-0 sm:group-hover/message:opacity-100 transition-opacity duration-200 p-2 sm:p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${
                                isMine ? "order-first" : ""
                            }`}
                            title="Reply"
                            aria-label="Reply to message"
                        >
                            <Reply className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500 hover:text-orange-500 transition-colors" />
                        </button>
                    )}

                    {/* Message actions menu */}
                    {(onEdit || onDelete || onCopy || onForward || onReact) && (
                        <MessageActions
                            message={message}
                            isOwnMessage={isMine}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onCopy={onCopy}
                            onForward={onForward}
                            onReact={onReact}
                        />
                    )}
                </div>
            </div>
        </div>
    );
});

export default MessageBubble;
