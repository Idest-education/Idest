"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Edit, Trash2, Copy, Forward, Smile } from "lucide-react";
import type { MessageDto } from "@/types/conversation";

interface MessageActionsProps {
    message: MessageDto;
    isOwnMessage: boolean;
    onEdit?: (message: MessageDto) => void;
    onDelete?: (messageId: string) => void;
    onCopy?: (text: string) => void;
    onForward?: (message: MessageDto) => void;
    onReact?: (messageId: string, emoji: string) => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function MessageActions({
    message,
    isOwnMessage,
    onEdit,
    onDelete,
    onCopy,
    onForward,
    onReact,
}: MessageActionsProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [portalMounted, setPortalMounted] = useState(false);
    const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

    const isOpen = showMenu || showReactions;

    const updateAnchor = () => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Anchor to bottom-right of the trigger button
        setAnchor({
            // NOTE: popover is `position: fixed`, so we use viewport coords (no scroll offset)
            top: rect.bottom,
            left: rect.right,
        });
    };

    useEffect(() => {
        setPortalMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        updateAnchor();
        const onScrollOrResize = () => updateAnchor();
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
        return () => {
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
                setShowReactions(false);
            }
        };

        if (showMenu || showReactions) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [showMenu, showReactions]);

    const handleCopy = () => {
        if (onCopy) {
            onCopy(message.content);
        } else {
            navigator.clipboard.writeText(message.content);
        }
        setShowMenu(false);
    };

    const handleDelete = () => {
        if (onDelete && confirm("Are you sure you want to delete this message?")) {
            onDelete(message.id);
        }
        setShowMenu(false);
    };

    const handleEdit = () => {
        if (onEdit) {
            onEdit(message);
        }
        setShowMenu(false);
    };

    const handleForward = () => {
        if (onForward) {
            onForward(message);
        }
        setShowMenu(false);
    };

    const handleReact = (emoji: string) => {
        if (onReact) {
            onReact(message.id, emoji);
        }
        setShowReactions(false);
    };

    const popover =
        portalMounted && anchor && (showMenu || showReactions)
            ? createPortal(
            <div
                ref={menuRef}
                className="fixed z-[10050]"
                style={{ top: anchor.top + 8, left: anchor.left }}
            >
                {showMenu && (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] animate-fadeIn -translate-x-full">
                        {onReact && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowReactions(true);
                                    setShowMenu(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Smile className="w-4 h-4" />
                                React
                            </button>
                        )}
                        {onCopy && (
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Copy className="w-4 h-4" />
                                Copy
                            </button>
                        )}
                        {onForward && (
                            <button
                                type="button"
                                onClick={handleForward}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Forward className="w-4 h-4" />
                                Forward
                            </button>
                        )}
                        {isOwnMessage && onEdit && (
                            <button
                                type="button"
                                onClick={handleEdit}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Edit className="w-4 h-4" />
                                Edit
                            </button>
                        )}
                        {isOwnMessage && onDelete && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        )}
                    </div>
                )}

                {showReactions && (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 animate-fadeIn -translate-x-full">
                        <div className="flex gap-1">
                            {QUICK_REACTIONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleReact(emoji)}
                                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-50 rounded transition-colors hover:scale-110 active:scale-95"
                                    aria-label={`React with ${emoji}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>,
            document.body,
        )
            : null;

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    setShowMenu(!showMenu);
                    setShowReactions(false);
                }}
                className="p-2 sm:p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors opacity-0 sm:group-hover/message:opacity-100 touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                aria-label="Message actions"
                title="More options"
                aria-expanded={showMenu}
                aria-haspopup="true"
            >
                <MoreVertical className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500" />
            </button>
            {popover}
        </div>
    );
}






