// ====================
// 🎯 DTO (Request)
// ====================

// Tạo hội thoại mới
export interface CreateConversationDto {
  title?: string;
  participantIds: string[];     // danh sách participant IDs
  ownerId: string;            // 🆕 người tạo cuộc hội thoại
}

// Gửi tin nhắn
export interface SendMessageDto {
  content: string;             // Nội dung tin nhắn
  attachments?: string[];      // (Tuỳ chọn) danh sách URL file đính kèm
}

// Thêm người vào group
export interface AddParticipantDto {
  userIds: string[];           // Danh sách ID user cần thêm
}

// ====================
// 🎯 DTO (Response)
// ====================

// Thông tin một hội thoại
export interface ConversationDto {
  id: string;
  title?: string;
  participants: string[];
  messages?: MessageDto[];    // 🆕 thêm messages để preview ở ConversationList
  createdAt: string;
  updatedAt: string;
}

// Danh sách hội thoại (phân trang)
export interface ConversationsListDto {
  items: ConversationDto[];
  nextCursor?: string | null;
}

// Tin nhắn trong hội thoại
export interface MessageDto {
  id: string;
  senderId: string;
  content: string;
  attachments?: string[];
  createdAt: string;
}

// Danh sách tin nhắn (phân trang)
export interface MessagesListDto {
  messages: MessageDto[];
  nextCursor?: string | null;
}

// Thông tin chi tiết hội thoại (gồm tin nhắn + participants)
export interface ConversationWithMessagesDto extends ConversationDto {
  messages: MessageDto[];
}

// Kết quả khi thêm participant
export interface ConversationParticipantDto {
  conversationId: string;
  userIds: string[];
  addedBy: string;
  addedAt: string;
}
