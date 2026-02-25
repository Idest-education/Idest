"use client";

import { useMemo, useState, useEffect, type MouseEvent } from "react";
import { conversationService } from "@/services/conversation.service";
import { ConversationDto } from "@/types/conversation";
import ChatWindow from "./ChatWindow";
import { X, Users, Trash2 } from "lucide-react";
import { socket, connectSocket } from "@/lib/socket";
import CreateGroupConversation from "./CreateGroupConversation";
import ParticipantList from "./ParticipantList";
import EditGroupConversation from "./EditGroupConversation";
import { searchUsers, type SearchUserSummary } from "@/services/user.service";

interface ConversationPopupProps {
    onClose: () => void;
    onSelectConversation?: (conversationId: string, displayName: string) => void; // 👈 callback khi chọn hội thoại
    defaultConversationId?: string; // 👈 dùng khi hiển thị ChatWindow mini
    receiverName?: string;
    activeConversationId?: string | null;
    activeConversationName?: string | null;
    onActiveConversationChange?: (conversationId: string | null, displayName?: string) => void;
    unreadConversationIds?: string[];
    onClearUnread?: (conversationId: string) => void;
}

export default function ConversationPopup({
    onClose,
    onSelectConversation,
    defaultConversationId,
    receiverName,
    activeConversationId,
    activeConversationName,
    onActiveConversationChange,
    unreadConversationIds = [],
    onClearUnread,
}: ConversationPopupProps) {
    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(
        activeConversationId ?? defaultConversationId ?? null,
    );
    const [loading, setLoading] = useState(true);
    const [createMode, setCreateMode] = useState<"none" | "direct" | "group">("none");
    const [directQuery, setDirectQuery] = useState("");
    const [directResults, setDirectResults] = useState<SearchUserSummary[]>([]);
    const [directSearching, setDirectSearching] = useState(false);
    const [directBusy, setDirectBusy] = useState(false);
    const [directError, setDirectError] = useState<string | null>(null);

    const [conversationDetail, setConversationDetail] = useState<ConversationDto | null>(null);
    const [showParticipants, setShowParticipants] = useState(false);

    const currentUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

    // Nếu có defaultConversationId thì mở luôn ChatWindow
    useEffect(() => {
        if (defaultConversationId) setSelectedId(defaultConversationId);
    }, [defaultConversationId]);

    // keep selectedId in sync with drawer state
    useEffect(() => {
        if (activeConversationId !== undefined) {
            setSelectedId(activeConversationId ?? null);
        }
    }, [activeConversationId]);

    useEffect(() => {
        conversationService
            .getUserConversations({ limit: 50 })
            .then((res) => setConversations(res.items))
            .finally(() => setLoading(false));

        // Connect socket and listen for real-time updates
        const token = localStorage.getItem("access_token");
        if (token) {
            connectSocket(token);

            // Listen for new conversations
            socket.on("conversation-created", (conversation: ConversationDto) => {
                setConversations((prev) => {
                    if (prev.find((c) => c.id === conversation.id)) return prev;
                    return [conversation, ...prev];
                });
            });

            // Listen for deleted conversations
            socket.on("conversation-deleted", (data: { conversationId: string }) => {
                setConversations((prev) => prev.filter((c) => c.id !== data.conversationId));
                // Close chat window if deleted conversation is currently open
                if (selectedId === data.conversationId) {
                    setSelectedId(null);
                }
            });

            socket.on("conversation-updated", (updated: ConversationDto) => {
                setConversations((prev) =>
                    prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
                );
                setConversationDetail((prev) =>
                    prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
                );
            });

            // participant events (group chats)
            socket.on("participant-added", (participant: any) => {
                const conversationId = participant?.conversationId as string | undefined;
                if (!conversationId) return;

                setConversations((prev) =>
                    prev.map((c) => {
                        if (c.id !== conversationId) return c;
                        if (c.participants?.some((p) => p.userId === participant.userId)) return c;
                        return { ...c, participants: [...(c.participants || []), participant] };
                    }),
                );

                setConversationDetail((prev) => {
                    if (!prev || prev.id !== conversationId) return prev;
                    if (prev.participants?.some((p) => p.userId === participant.userId)) return prev;
                    return { ...prev, participants: [...(prev.participants || []), participant] };
                });
            });

            socket.on("participant-removed", (payload: any) => {
                const removedUserId = payload?.userId as string | undefined;
                if (!removedUserId) return;

                // The backend payload does not include conversationId; we can only safely update the currently open conversation detail.
                setConversationDetail((prev) => {
                    if (!prev) return prev;
                    if (!prev.participants?.some((p) => p.userId === removedUserId)) return prev;
                    return {
                        ...prev,
                        participants: prev.participants.filter((p) => p.userId !== removedUserId),
                    };
                });
            });
        }

        return () => {
            socket.off("conversation-created");
            socket.off("conversation-deleted");
            socket.off("conversation-updated");
            socket.off("participant-added");
            socket.off("participant-removed");
        };
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        conversationService
            .getConversationById(selectedId, { limit: 30 })
            .then((res) => setConversationDetail(res.conversation))
            .catch(() => setConversationDetail(null));
    }, [selectedId]);

    useEffect(() => {
        if (createMode !== "direct") return;
        const q = directQuery.trim();
        if (q.length < 2) {
            setDirectResults([]);
            return;
        }

        const handle = setTimeout(async () => {
            setDirectSearching(true);
            try {
                const users = await searchUsers(q);
                setDirectResults(users);
            } catch (e) {
                console.error(e);
            } finally {
                setDirectSearching(false);
            }
        }, 250);

        return () => clearTimeout(handle);
    }, [createMode, directQuery]);

    const handleStartDirectWithUser = async (user: SearchUserSummary) => {
        if (!user?.id) return;

        setDirectBusy(true);
        setDirectError(null);
        try {
            const conversation = await conversationService.getDirectConversation(user.id);
            setConversations((prev) => {
                if (prev.find((c) => c.id === conversation.id)) return prev;
                return [conversation, ...prev];
            });

            const other = conversation.participants.find((p) => p.userId !== currentUserId);
            const displayName = conversation.isGroup
                ? (conversation.title || "Group")
                : (other?.user.full_name || "Direct message");

            onSelectConversation?.(conversation.id, displayName);
            setCreateMode("none");
            setDirectQuery("");
            setDirectResults([]);
        } catch (e: any) {
            setDirectError(e?.message || "Failed to create direct conversation");
        } finally {
            setDirectBusy(false);
        }
    };

    const handleDeleteConversation = async (conversationId: string, e: MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this conversation?")) return;

        try {
            await conversationService.deleteConversation(conversationId);
            setConversations((prev) => prev.filter((c) => c.id !== conversationId));
            if (selectedId === conversationId) {
                setSelectedId(null);
                setConversationDetail(null);
            }
        } catch (err) {
            console.error(err);
            alert("Unable to delete conversation");
        }
    };

    const canShowParticipants = useMemo(() => {
        return !!conversationDetail?.isGroup;
    }, [conversationDetail?.isGroup]);

    const selectedDisplayName = useMemo(() => {
        if (activeConversationName) return activeConversationName;
        if (conversationDetail) {
            if (conversationDetail.isGroup) return conversationDetail.title || "Cuộc trò chuyện";
            const other = conversationDetail.participants.find((p) => p.userId !== currentUserId);
            return other?.user.full_name || "Direct message";
        }
        const fromList = conversations.find((c) => c.id === selectedId);
        if (!fromList) return "Tin nhắn";
        if (fromList.isGroup) return fromList.title || "Cuộc trò chuyện";
        const other = fromList.participants.find((p) => p.userId !== currentUserId);
        return other?.user.full_name || "Direct message";
    }, [activeConversationName, conversationDetail, conversations, currentUserId, selectedId]);

    // Nếu popup được dùng để hiển thị ChatWindow mini
    if (defaultConversationId) {
        return (
            <div className="w-[380px] bg-white border border-indigo-100 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                <div className="flex justify-between items-center px-4 py-3 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <span className="font-semibold text-lg truncate">{receiverName}</span>
                    <div className="flex items-center gap-2">
                        {canShowParticipants && (
                            <button
                                type="button"
                                onClick={() => setShowParticipants((v) => !v)}
                                className="text-sm hover:bg-white/20 rounded-lg px-2 py-1"
                            >
                                Participants
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-sm hover:bg-white/20 rounded-lg px-2 py-1"
                        >
                            ✕
                        </button>
                    </div>
                </div>
                {showParticipants && conversationDetail && (
                    <div className="p-3 border-b bg-white">
                        <ParticipantList conversation={conversationDetail} onConversationUpdated={setConversationDetail} />
                    </div>
                )}
                <ChatWindow conversationId={selectedId!} onBack={onClose} />
            </div>
        );
    }

    // Drawer UI: side panel list + inline chat
    return (
        <div className="h-full flex">
            {/* Sidebar */}
            <div className="w-[340px] border-r border-gray-200 bg-white flex flex-col">
                <div className="flex items-center justify-between px-4 py-4 border-b">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">Messages</h3>
                        <p className="text-xs text-gray-500">Direct & group chats</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition">
                        <X className="w-5 h-5 text-gray-700" />
                    </button>
                </div>

                <div className="p-3 border-b bg-white flex gap-2">
                    <button
                        type="button"
                        onClick={() => setCreateMode((m) => (m === "direct" ? "none" : "direct"))}
                        className="flex-1 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
                    >
                        New direct
                    </button>
                    <button
                        type="button"
                        onClick={() => setCreateMode((m) => (m === "group" ? "none" : "group"))}
                        className="flex-1 bg-orange-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-orange-600 transition"
                    >
                        New group
                    </button>
                </div>

                {createMode === "direct" && (
                    <div className="p-3 border-b bg-white animate-fadeIn">
                        <p className="text-xs text-gray-600 mb-2">Create direct conversation by name</p>
                        <input
                            value={directQuery}
                            onChange={(e) => setDirectQuery(e.target.value)}
                            placeholder="Search users by name..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                        />

                        {(directSearching || directResults.length > 0) && (
                            <div className="mt-2 border border-gray-200 rounded-lg max-h-56 overflow-y-auto">
                                {directSearching && (
                                    <div className="p-3 text-sm text-gray-500">Searching...</div>
                                )}
                                {!directSearching && directResults.length === 0 && directQuery.trim().length >= 2 && (
                                    <div className="p-3 text-sm text-gray-500">No users found.</div>
                                )}
                                {!directSearching &&
                                    directResults.map((u) => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            disabled={directBusy}
                                            onClick={() => handleStartDirectWithUser(u)}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-orange-50 transition text-left disabled:opacity-60"
                                        >
                                            {u.avatar_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={u.avatar_url}
                                                    alt={u.full_name}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs font-semibold">
                                                    {u.full_name?.[0]?.toUpperCase() ?? "U"}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                                                <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                            </div>
                                            <span className="text-xs text-gray-500">{u.role}</span>
                                        </button>
                                    ))}
                            </div>
                        )}

                        {directError && <p className="text-sm text-red-600 mt-2">{directError}</p>}
                    </div>
                )}

                {createMode === "group" && (
                    <div className="p-3 border-b bg-white animate-fadeIn">
                        <CreateGroupConversation
                            onCancel={() => setCreateMode("none")}
                            onCreated={(c) => {
                                setConversations((prev) => {
                                    if (prev.find((x) => x.id === c.id)) return prev;
                                    return [c, ...prev];
                                });
                                setCreateMode("none");
                            }}
                        />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2">
                    {loading && <p className="text-gray-500 text-sm p-3">Đang tải...</p>}
                    {!loading && conversations.length === 0 && (
                        <p className="text-gray-400 text-sm italic p-3">Chưa có cuộc hội thoại nào.</p>
                    )}

                    <div className="space-y-1">
                        {conversations.map((conv) => {
                            const other = conv.participants.find((p) => p.userId !== currentUserId);
                            const displayName = conv.isGroup
                                ? (conv.title || "Cuộc trò chuyện")
                                : (other?.user.full_name || "Direct message");

                            const isActive = conv.id === selectedId;
                            const isUnread = unreadConversationIds.includes(conv.id);

                            // Avatar:
                            // - group: conversation.avatar_url (if set)
                            // - direct: other user's avatar
                            const avatarUrl = conv.isGroup ? conv.avatar_url : other?.user?.avatar_url;

                            return (
                                <div
                                    key={conv.id}
                                    className={`group w-full rounded-xl transition flex gap-3 items-center px-3 py-3 ${
                                        isActive ? "bg-orange-50 border border-orange-100" : "hover:bg-gray-50"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedId(conv.id);
                                            onActiveConversationChange?.(conv.id, displayName);
                                            onSelectConversation?.(conv.id, displayName);
                                            onClearUnread?.(conv.id);
                                        }}
                                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                                    >
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        {avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={avatarUrl}
                                                alt={displayName}
                                                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                            />
                                        ) : conv.isGroup ? (
                                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                                                <Users className="w-6 h-6 text-orange-600" />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                                <span className="text-gray-500 text-sm font-medium">
                                                    {displayName.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        {isUnread && (
                                            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-white" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className="font-semibold text-gray-900 truncate">{displayName}</p>
                                        </div>
                                        <p className="text-sm text-gray-500 truncate">
                                            {conv.messages?.[0]?.content || "Chưa có tin nhắn nào"}
                                        </p>
                                    </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-white"
                                        title="Delete conversation"
                                    >
                                        <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main chat panel */}
            <div className="flex-1 bg-gradient-to-b from-gray-50 to-white flex flex-col">
                <div className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                    <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {conversationDetail?.isGroup ? (
                                conversationDetail.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={conversationDetail.avatar_url}
                                        alt={selectedDisplayName}
                                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center border border-orange-200">
                                        <Users className="w-5 h-5 text-orange-600" />
                                    </div>
                                )
                            ) : null}

                            <div className="min-w-0">
                                <p className="text-sm text-gray-500">Chat</p>
                                <h4 className="font-semibold text-gray-900 truncate">{selectedDisplayName}</h4>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {conversationDetail?.isGroup && conversationDetail && (
                                <EditGroupConversation
                                    conversationId={conversationDetail.id}
                                    initialTitle={conversationDetail.title}
                                    initialAvatarUrl={conversationDetail.avatar_url}
                                    onUpdated={(updated) => {
                                        setConversationDetail(updated);
                                        setConversations((prev) =>
                                            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
                                        );
                                    }}
                                />
                            )}
                            {canShowParticipants && (
                                <button
                                    type="button"
                                    onClick={() => setShowParticipants((v) => !v)}
                                    className="text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                                >
                                    Participants
                                </button>
                            )}
                        </div>
                    </div>

                    {showParticipants && conversationDetail && (
                        <div className="px-5 pb-4 animate-fadeIn">
                            <ParticipantList
                                conversation={conversationDetail}
                                onConversationUpdated={setConversationDetail}
                            />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-h-0 p-5">
                    {!selectedId ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-gray-900 font-semibold">Select a conversation</p>
                                <p className="text-gray-500 text-sm mt-1">Choose a chat from the left panel to start messaging.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full">
                            <ChatWindow conversationId={selectedId} onBack={() => void 0} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
