"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, File, Image as ImageIcon, Video, FileText } from "lucide-react";
import type { AttachmentDto } from "@/types/conversation";

interface AttachmentPreviewProps {
    attachment: AttachmentDto;
    isOwnMessage?: boolean;
}

function isImageAttachment(att: AttachmentDto): boolean {
    const t = (att.type || "").toLowerCase();
    if (t.includes("image")) return true;
    const url = (att.url || "").toLowerCase();
    return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].some((ext) => url.endsWith(ext));
}

function isVideoAttachment(att: AttachmentDto): boolean {
    const t = (att.type || "").toLowerCase();
    if (t.includes("video")) return true;
    const url = (att.url || "").toLowerCase();
    return [".mp4", ".webm", ".mov", ".avi"].some((ext) => url.endsWith(ext));
}

function isPdfAttachment(att: AttachmentDto): boolean {
    const t = (att.type || "").toLowerCase();
    if (t.includes("pdf")) return true;
    const url = (att.url || "").toLowerCase();
    return url.endsWith(".pdf");
}

function formatFileSize(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentPreview({ attachment, isOwnMessage = false }: AttachmentPreviewProps) {
    const [imageError, setImageError] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);
    const [portalMounted, setPortalMounted] = useState(false);

    const url = attachment.url || "";
    const filename = attachment.filename || url || "attachment";
    const fileSize = formatFileSize(attachment.size);

    useEffect(() => {
        setPortalMounted(true);
    }, []);

    if (isImageAttachment(attachment) && url && !imageError) {
        return (
            <>
                <div 
                    className="relative group cursor-pointer"
                    onClick={() => setShowLightbox(true)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={url}
                        alt={filename}
                        className="max-w-[280px] h-auto rounded-lg border-2 border-white/20 hover:border-white/40 transition-colors pointer-events-none"
                        loading="lazy"
                        onError={() => setImageError(true)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <span className="text-white text-xs font-medium">Click to view</span>
                    </div>
                </div>
                {portalMounted && showLightbox
                    ? createPortal(
                          <div
                              className="fixed inset-0 z-[10050] bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
                              onClick={() => setShowLightbox(false)}
                          >
                              <button
                                  type="button"
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setShowLightbox(false);
                                  }}
                                  className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-10 bg-black/50 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
                                  aria-label="Close"
                              >
                                  ✕
                              </button>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                  src={url}
                                  alt={filename}
                                  className="max-w-full max-h-full rounded-lg"
                                  onClick={(e) => e.stopPropagation()}
                              />
                          </div>,
                          document.body,
                      )
                    : null}
            </>
        );
    }

    if (isVideoAttachment(attachment) && url) {
        return (
            <div className="relative max-w-[280px]">
                <video
                    src={url}
                    controls
                    className="w-full rounded-lg border-2 border-white/20"
                    preload="metadata"
                >
                    Your browser does not support the video tag.
                </video>
            </div>
        );
    }

    // File attachment
    return (
        <a
            href={url || undefined}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${
                isOwnMessage
                    ? "bg-white/20 border-white/30 hover:bg-white/30 text-white"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-900"
            }`}
        >
            <div className="flex-shrink-0">
                {isPdfAttachment(attachment) ? (
                    <FileText className={`w-5 h-5 ${isOwnMessage ? "text-white" : "text-red-500"}`} />
                ) : (
                    <File className={`w-5 h-5 ${isOwnMessage ? "text-white" : "text-gray-500"}`} />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${isOwnMessage ? "text-white" : "text-gray-900"}`}>
                    {filename}
                </p>
                {fileSize && (
                    <p className={`text-xs ${isOwnMessage ? "text-white/70" : "text-gray-500"}`}>
                        {fileSize}
                    </p>
                )}
            </div>
            <Download className={`w-4 h-4 flex-shrink-0 ${isOwnMessage ? "text-white/70" : "text-gray-400"}`} />
        </a>
    );
}




