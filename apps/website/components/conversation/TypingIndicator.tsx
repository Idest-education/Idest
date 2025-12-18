"use client";

interface TypingIndicatorProps {
    users: string[];
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
    if (users.length === 0) return null;

    const displayText = users.length === 1 
        ? `${users[0]} is typing...`
        : `${users.length} people are typing...`;

    return (
        <div className="flex items-center gap-2 px-4 py-2 animate-fadeIn">
            <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-gray-500 italic">{displayText}</span>
        </div>
    );
}




