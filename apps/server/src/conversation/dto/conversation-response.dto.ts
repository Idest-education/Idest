export interface UserSummaryDto {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

export interface ConversationParticipantDto {
  id: string;
  userId: string;
  conversationId: string;
  joinedAt: Date;
  user: UserSummaryDto;
}

export interface MessageSenderDto {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export interface MessageDto {
  id: string;
  content: string;
  type: string;
  sentAt: Date;
  senderId: string;
  conversationId?: string;
  replyToId?: string;
  attachments?: any;
  sender: MessageSenderDto;
  conversation?: {
    id: string;
    isGroup: boolean;
  };
}

export interface ConversationDto {
  id: string;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  title?: string;
  createdBy: string;
  ownerId?: string;
  isDeleted: boolean;
  classId?: string;
  participants: ConversationParticipantDto[];
  messages: MessageDto[];
  _count?: {
    messages: number;
  };
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
