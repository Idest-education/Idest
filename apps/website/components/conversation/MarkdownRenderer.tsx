"use client";

import { useMemo } from "react";

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * Simple markdown renderer for chat messages
 * Supports: bold, italic, links, code, line breaks
 */
export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
    const rendered = useMemo(() => {
        let text = content;

        // Escape HTML to prevent XSS
        text = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        text = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-blue-600 hover:text-blue-800">$1</a>');

        // Convert markdown bold **text** or __text__
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
        text = text.replace(/__(.+?)__/g, '<strong class="font-semibold">$1</strong>');

        // Convert markdown italic *text* or _text_
        text = text.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
        text = text.replace(/_(.+?)_/g, '<em class="italic">$1</em>');

        // Convert inline code `code`
        text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

        // Convert line breaks
        text = text.replace(/\n/g, '<br />');

        return text;
    }, [content]);

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{ __html: rendered }}
        />
    );
}




