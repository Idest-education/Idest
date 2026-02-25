"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label: string;
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-all duration-200 group disabled:opacity-50"
      title={`Sao chép ${label}`}
      disabled={copied}
    >
      {copied ? (
        <>
          <CheckIcon size={12} className="text-green-600" />
          Đã sao chép!
        </>
      ) : (
        <>
          <CopyIcon size={12} className="group-hover:scale-110 transition-transform" />
          Sao chép {label}
        </>
      )}
    </button>
  );
}