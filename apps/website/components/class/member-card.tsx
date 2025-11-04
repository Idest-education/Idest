"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import DefaultAvatar from "@/assets/default-avatar.png";
import { conversationService } from "@/services/conversation.service";
import { MessageCircle } from "lucide-react";

interface MemberCardProps {
    member: {
        id: string;
        full_name: string;
    };
    onConversationCreated?: (conversationId: string, fullName: string) => void;
}

export default function MemberCard({ member, onConversationCreated }: MemberCardProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const handleCreateConversation = async () => {
        setLoading(true);
        const ownerId = localStorage.getItem("user_id");
        if (!ownerId) {
            alert("Chưa đăng nhập!");
            return;
        }

        try {
            const dto = {
                ownerId,
                participantIds: [member.id],
            };

            const conversation = await conversationService.createConversation(dto);

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
        <div className="relative" ref={menuRef}>
            {/* Card */}
            <div
                className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl text-center border border-blue-200 hover:shadow-md hover:scale-105 transition-all cursor-pointer"
                onClick={() => setShowMenu((prev) => !prev)}
            >
                <Image
                    src={DefaultAvatar}
                    alt={member.full_name}
                    width={60}
                    height={60}
                    className="mx-auto rounded-full ring-4 ring-white shadow-md"
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
                        className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50 w-full rounded-lg transition disabled:opacity-50"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Nhắn tin
                    </button>
                </div>
            )}
        </div>
    );
}

