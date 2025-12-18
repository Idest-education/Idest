"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import type { MessageDto } from "@/types/conversation";

interface MessageSearchProps {
    messages: MessageDto[];
    onSelectMessage?: (messageId: string) => void;
    onClose?: () => void;
}

export default function MessageSearch({ messages, onSelectMessage, onClose }: MessageSearchProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const results = useMemo(() => {
        if (!query.trim()) return [];
        
        const lowerQuery = query.toLowerCase();
        return messages
            .filter((msg) => 
                msg.content.toLowerCase().includes(lowerQuery)
            )
            .map((msg) => ({
                message: msg,
                index: messages.indexOf(msg),
            }));
    }, [messages, query]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const handleSelect = (messageId: string) => {
        if (onSelectMessage) {
            onSelectMessage(messageId);
        }
        if (onClose) {
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            if (onClose) onClose();
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
            return;
        }

        if (e.key === "Enter" && results[selectedIndex]) {
            e.preventDefault();
            handleSelect(results[selectedIndex].message.id);
            return;
        }
    };

    const highlightText = (text: string, query: string) => {
        if (!query.trim()) return text;
        
        const parts = text.split(new RegExp(`(${query})`, "gi"));
        return parts.map((part, i) => 
            part.toLowerCase() === query.toLowerCase() ? (
                <mark key={i} className="bg-yellow-200 text-gray-900 px-0.5 rounded">
                    {part}
                </mark>
            ) : (
                part
            )
        );
    };

    return (
        <div className="border-b bg-white p-3 animate-fadeIn">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search messages..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 text-sm"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            inputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Clear search"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                )}
            </div>

            {query && results.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto">
                    <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50">
                        {results.length} result{results.length !== 1 ? "s" : ""} found
                    </div>
                    {results.map((result, idx) => (
                        <button
                            key={result.message.id}
                            type="button"
                            onClick={() => handleSelect(result.message.id)}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${
                                idx === selectedIndex ? "bg-orange-50 border-l-2 border-orange-500" : ""
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-600">
                                    {result.message.sender?.full_name}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {new Date(result.message.sentAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>
                            <p className="text-sm text-gray-900 line-clamp-2">
                                {highlightText(result.message.content, query)}
                            </p>
                        </button>
                    ))}
                </div>
            )}

            {query && results.length === 0 && (
                <div className="mt-2 text-sm text-gray-500 text-center py-4">
                    No messages found
                </div>
            )}

            {query && results.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
                    <div className="flex items-center gap-2">
                        <span>
                            {selectedIndex + 1} / {results.length}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}




