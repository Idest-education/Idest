"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConversationDto, CreateConversationDto } from "@/types/conversation";
import { conversationService } from "@/services/conversation.service";
import { searchUsers, type SearchUserSummary } from "@/services/user.service";

interface CreateGroupConversationProps {
  onCreated?: (conversation: ConversationDto) => void;
  onCancel?: () => void;
}

export default function CreateGroupConversation({ onCreated, onCancel }: CreateGroupConversationProps) {
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserSummary[]>([]);
  const [selected, setSelected] = useState<SearchUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const participantIds = useMemo(() => {
    return selected.map((u) => u.id);
  }, [selected]);

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && participantIds.length > 0;
  }, [title, participantIds.length]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchUsers(q);
        // Remove already selected users from results
        const selectedIds = new Set(selected.map((u) => u.id));
        setResults(users.filter((u) => !selectedIds.has(u.id)));
      } catch (e: any) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query, selected]);

  const handleCreate = async () => {
    setError(null);
    if (!canSubmit) return;

    const payload: CreateConversationDto = {
      isGroup: true,
      title: title.trim(),
      participantIds,
      classId: classId.trim() || undefined,
    };

    setBusy(true);
    try {
      const conversation = await conversationService.createConversation(payload);
      onCreated?.(conversation);
    } catch (e: any) {
      setError(e?.message || "Failed to create conversation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900">Create group conversation</h4>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Study group"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add participants</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />

          {selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelected((prev) => prev.filter((x) => x.id !== u.id))}
                  className="inline-flex items-center gap-2 text-xs bg-gray-100 border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-200 transition"
                  title="Remove"
                >
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt={u.full_name} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-orange-100 inline-flex items-center justify-center text-[10px] text-orange-700">
                      {u.full_name?.[0]?.toUpperCase() ?? "U"}
                    </span>
                  )}
                  <span className="truncate max-w-[160px]">{u.full_name}</span>
                  <span className="text-gray-500">✕</span>
                </button>
              ))}
            </div>
          )}

          {(searching || results.length > 0) && (
            <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {searching && (
                <div className="p-3 text-sm text-gray-500">Searching...</div>
              )}
              {!searching && results.length === 0 && query.trim().length >= 2 && (
                <div className="p-3 text-sm text-gray-500">No users found.</div>
              )}
              {!searching &&
                results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelected((prev) => [...prev, u]);
                      setQuery("");
                      setResults([]);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-orange-50 transition text-left"
                  >
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt={u.full_name} className="w-8 h-8 rounded-full object-cover" />
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class ID (optional)</label>
          <input
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder="class-uuid"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit || busy}
            className="bg-orange-500 disabled:bg-orange-300 text-white px-4 py-2 rounded-lg text-sm"
          >
            {busy ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}




