"use client";

import { useState, useRef, useEffect } from "react";
import DefaultAvatar from "@/assets/default-avatar.png";
import { conversationService } from "@/services/conversation.service";
import { MessageCircle } from "lucide-react";

interface MemberCardProps {
    member: {
        id: string;
        full_name: string;
        avatar_url?: string;
    };
    onConversationCreated?: (conversationId: string, fullName: string) => void;
}

export default function MemberCard({ member, onConversationCreated }: MemberCardProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const handleCreateConversation = async () => {
        setLoading(true);
        const currentUserId = localStorage.getItem("user_id");
        if (!currentUserId) {
            alert("Chưa đăng nhập!");
            return;
        }

        try {
            // Use getDirectConversation to get or create a direct conversation
            const conversation = await conversationService.getDirectConversation(member.id);

            onConversationCreated?.(conversation.id, member.full_name);
            setShowMenu(false);
        } catch (err) {
            console.error("Lỗi tạo cuộc hội thoại:", err);
            alert("Không thể tạo cuộc hội thoại.");
        } finally {
            setLoading(false);
        }
    };

    // Đóng popup khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        if (showMenu) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu]);

    return (
        <div className="relative aspect-square" ref={menuRef}>
            {/* Card */}
            <div
                className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl text-center border border-blue-200 hover:shadow-md hover:scale-105 transition-all cursor-pointer h-full flex flex-col items-center justify-center"
                onClick={() => setShowMenu((prev) => !prev)}
            >
                {/* Use a regular img so we can support any avatar domain without Next image config */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={
                        member.avatar_url ||
                        // DefaultAvatar is a static import object; use its src field
                        (typeof DefaultAvatar === "string" ? DefaultAvatar : (DefaultAvatar as { src: string }).src)
                    }
                    alt={member.full_name}
                    width={100}
                    height={100}
                    className="mx-auto rounded-lg ring-4 ring-white shadow-md object-cover w-[100px] h-[100px]"
                />
                <p className="mt-3 text-sm font-semibold text-gray-800 line-clamp-2">
                    {member.full_name}
                </p>
            </div>

            {/* Popup menu */}
            {showMenu && (
                <div
                    className="absolute left-1/2 top-full mt-2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-[180px] animate-fade-in"
                >
                    <button
                        onClick={handleCreateConversation}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 w-full rounded-lg transition disabled:opacity-50"
                    >
                        <MessageCircle className="w-4 h-4" />
                        {loading ? "Đang tạo..." : "Nhắn tin"}
                    </button>
                </div>
            )}
        </div>
    );
}

