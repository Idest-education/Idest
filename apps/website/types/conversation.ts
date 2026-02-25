// Types aligned with `ie-backend/src/conversation/dto/*`

// ====================
// 🎯 DTO (Request)
// ====================

export interface CreateConversationDto {
  /** Whether this is a group conversation (default false) */
  isGroup?: boolean;
  /** Array of user IDs to include as participants */
  participantIds: string[];
  /** Title for group conversations */
  title?: string;
  /** Avatar URL for group conversations */
  avatar_url?: string;
  /** Optional: class conversation */
  classId?: string;
  /** Optional: ownerId (defaults to current user in backend) */
  ownerId?: string;
}

export type AttachmentDto = {
  type?: string;
  url?: string;
  filename?: string;
  size?: number;
  [key: string]: any;
};

export interface SendMessageDto {
  content: string;
  replyToId?: string;
  attachments?: AttachmentDto[];
}

export interface AddParticipantDto {
  /** ID of the user to add as a participant */
  userId: string;
}

// ====================
// 🎯 DTO (Response)
// ====================

export interface UserSummaryDto {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

export interface ConversationParticipantDto {
  id: string;
  userId: string;
  conversationId: string;
  joinedAt: string; // ISO date string
  user: UserSummaryDto;
}

export type MessageType = "DIRECT" | "CLASSROOM" | "MEETING";

export interface MessageSenderDto {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

export interface ConversationSummaryDto {
  id: string;
  isGroup: boolean;
}

export interface MessageDto {
  id: string;
  content: string;
  type: MessageType;
  sentAt: string; // ISO date string
  senderId: string;
  conversationId?: string;
  replyToId?: string;
  attachments?: AttachmentDto[] | null;
  sender: MessageSenderDto;
  conversation?: ConversationSummaryDto;
}

export interface ConversationCountDto {
  messages: number;
}

export interface ConversationDto {
  id: string;
  isGroup: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  title?: string;
  avatar_url?: string | null;
  createdBy: string;
  ownerId?: string;
  isDeleted: boolean;
  classId?: string;
  participants: ConversationParticipantDto[];
  /** Recent messages (may be empty) */
  messages: MessageDto[];
  _count?: ConversationCountDto;
}

export interface UpdateConversationDto {
  title?: string;
  avatar_url?: string;
}

export interface ConversationsListDto {
  items: ConversationDto[];
  nextCursor?: string;
}

export interface ConversationWithMessagesDto {
  conversation: ConversationDto;
  nextCursor?: string;
}

export interface MessagesListDto {
  messages: MessageDto[];
  hasMore: boolean;
  total: number;
  nextCursor?: string;
}
