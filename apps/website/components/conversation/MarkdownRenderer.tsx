"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * Full-featured markdown renderer
 * Supports: headings, bold, italic, links, code blocks, tables, lists, blockquotes, etc.
 */
export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Headings
                    h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-6 mb-4" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-5 mb-3" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
                    h4: ({ node, ...props }) => <h4 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                    h5: ({ node, ...props }) => <h5 className="text-base font-semibold mt-2 mb-1" {...props} />,
                    h6: ({ node, ...props }) => <h6 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                    
                    // Paragraphs
                    p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
                    
                    // Lists
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-1 ml-4" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-1 ml-4" {...props} />,
                    li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                    
                    // Links
                    a: ({ node, ...props }) => (
                        <a
                            className="underline text-blue-600 hover:text-blue-800"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                        />
                    ),
                    
                    // Code blocks
                    code: ({ node, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        return isInline ? (
                            <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                {children}
                            </code>
                        ) : (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    },
                    pre: ({ node, children, ...props }: any) => (
                        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono overflow-x-auto mb-4" {...props}>
                            {children}
                        </pre>
                    ),
                    
                    // Blockquotes
                    blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-700" {...props} />
                    ),
                    
                    // Tables (GitHub Flavored Markdown)
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                            <table className="min-w-full border-collapse border border-gray-300" {...props} />
                        </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-gray-100" {...props} />,
                    tbody: ({ node, ...props }) => <tbody {...props} />,
                    tr: ({ node, ...props }) => <tr className="border-b border-gray-200" {...props} />,
                    th: ({ node, ...props }) => (
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                        <td className="border border-gray-300 px-4 py-2" {...props} />
                    ),
                    
                    // Horizontal rule
                    hr: ({ node, ...props }) => <hr className="my-6 border-gray-300" {...props} />,
                    
                    // Images
                    img: ({ node, ...props }: any) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="max-w-full rounded my-4" alt={props.alt || ""} {...props} />
                    ),
                    
                    // Strong/Bold
                    strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                    
                    // Emphasis/Italic
                    em: ({ node, ...props }) => <em className="italic" {...props} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

