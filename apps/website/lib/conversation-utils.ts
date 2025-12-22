import type { AttachmentDto, ConversationDto, ConversationParticipantDto, MessageDto } from "@/types/conversation";

export function formatConversationTimestamp(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export function getOtherParticipant(
  conversation: ConversationDto,
  currentUserId: string | null,
): ConversationParticipantDto | undefined {
  if (!currentUserId) return undefined;
  return conversation.participants?.find((p) => p.userId !== currentUserId);
}

export function getConversationDisplayName(
  conversation: ConversationDto,
  currentUserId: string | null,
): string {
  if (conversation.isGroup) return conversation.title || "Cuộc trò chuyện";
  const other = getOtherParticipant(conversation, currentUserId);
  return other?.user?.full_name || "Direct message";
}

export function getLastMessagePreview(conversation: ConversationDto): string {
  const last = conversation.messages?.[0];
  return last?.content || "Chưa có tin nhắn nào";
}

export function validateAttachment(att: AttachmentDto): string | null {
  if (!att) return "Invalid attachment";
  if (!att.url || !String(att.url).trim()) return "Attachment url is required";
  if (att.size && typeof att.size === "number" && att.size > 25 * 1024 * 1024) {
    return "Attachment too large (max 25MB)";
  }
  return null;
}

export function getReplyPreview(message: MessageDto, messages: MessageDto[]): MessageDto | null {
  if (!message.replyToId) return null;
  return messages.find((m) => m.id === message.replyToId) ?? null;
}






