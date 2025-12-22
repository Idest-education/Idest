"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConversationDto, ConversationParticipantDto } from "@/types/conversation";
import { conversationService } from "@/services/conversation.service";
import { socket, connectSocket } from "@/lib/socket";
import { searchUsers, type SearchUserSummary } from "@/services/user.service";

interface ParticipantListProps {
  conversation: ConversationDto;
  onConversationUpdated?: (next: ConversationDto) => void;
}

export default function ParticipantList({ conversation, onConversationUpdated }: ParticipantListProps) {
  const [participants, setParticipants] = useState<ConversationParticipantDto[]>(
    conversation.participants || [],
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

  useEffect(() => {
    setParticipants(conversation.participants || []);
  }, [conversation.participants]);

  // realtime participant updates
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) connectSocket(token);

    const onAdded = (p: ConversationParticipantDto) => {
      if (p.conversationId !== conversation.id) return;
      setParticipants((prev) => {
        if (prev.some((x) => x.userId === p.userId)) return prev;
        return [...prev, p];
      });
    };

    const onRemoved = (payload: { userId: string } | { userId: string; conversationId?: string }) => {
      // gateway currently emits { userId }, without conversationId
      const removedUserId = payload.userId;
      setParticipants((prev) => prev.filter((x) => x.userId !== removedUserId));
    };

    socket.on("participant-added", onAdded);
    socket.on("participant-removed", onRemoved);

    return () => {
      socket.off("participant-added", onAdded);
      socket.off("participant-removed", onRemoved);
    };
  }, [conversation.id]);

  const isGroup = conversation.isGroup;

  const isCreator = useMemo(() => {
    // backend removeParticipant permission: conversation.participants[0]?.userId is creator
    return participants[0]?.userId && currentUserId && participants[0].userId === currentUserId;
  }, [participants, currentUserId]);

  const canRemove = (userId: string) => {
    if (!currentUserId) return false;
    if (userId === currentUserId) return true;
    return isGroup && isCreator;
  };

  useEffect(() => {
    if (!isGroup) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchUsers(q);
        const existingIds = new Set(participants.map((p) => p.userId));
        setResults(users.filter((u) => !existingIds.has(u.id)));
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [isGroup, participants, query]);

  const handleAddById = async (userId: string) => {
    setBusy(true);
    try {
      const participant = await conversationService.addParticipant(conversation.id, { userId });
      setParticipants((prev) => {
        if (prev.some((x) => x.userId === participant.userId)) return prev;
        const next = [...prev, participant];
        onConversationUpdated?.({ ...conversation, participants: next });
        return next;
      });
      setQuery("");
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!canRemove(userId)) return;
    if (!confirm("Remove this participant?")) return;

    setBusy(true);
    try {
      const ok = await conversationService.removeParticipant(conversation.id, userId);
      if (ok) {
        setParticipants((prev) => prev.filter((p) => p.userId !== userId));
        onConversationUpdated?.({
          ...conversation,
          participants: (conversation.participants || []).filter((p) => p.userId !== userId),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">Participants</p>
        <span className="text-xs text-gray-500">{participants.length}</span>
      </div>

      <div className="space-y-2">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {p.user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.user.avatar_url}
                  alt={p.user.full_name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-200" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">{p.user?.full_name || p.userId}</p>
                <p className="text-xs text-gray-500 truncate">{p.user?.email || ""}</p>
              </div>
            </div>

            {canRemove(p.userId) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRemove(p.userId)}
                className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {isGroup && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-gray-600 mb-2">Add participant by name</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />

          {(searching || results.length > 0) && (
            <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {searching && <div className="p-3 text-sm text-gray-500">Searching...</div>}
              {!searching && results.length === 0 && query.trim().length >= 2 && (
                <div className="p-3 text-sm text-gray-500">No users found.</div>
              )}
              {!searching &&
                results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleAddById(u.id)}
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
        </div>
      )}

      {!isGroup && (
        <p className="mt-3 text-xs text-gray-500">Direct conversations do not support participant changes.</p>
      )}
    </div>
  );
}






