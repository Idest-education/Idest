import { http } from "@/services/http";
import {
  CreateConversationDto,
  SendMessageDto,
  AddParticipantDto,
  ConversationDto,
  ConversationsListDto,
  ConversationWithMessagesDto,
  MessageDto,
  MessagesListDto,
  ConversationParticipantDto,
} from "@/types/conversation";

// 💬 Conversation API Service (Frontend)
export const conversationService = {
  /** 🧩 1️⃣ Tạo hội thoại mới (group hoặc direct) */
  async createConversation(data: CreateConversationDto): Promise<ConversationDto> {
  const res = await http.post("/conversation", data);
  return res.data.data;
},

  /** 🧩 2️⃣ Lấy danh sách hội thoại của user hiện tại */
  async getUserConversations(params?: { cursor?: string; limit?: number }): Promise<ConversationsListDto> {
    const res = await http.get("/conversation", { params });
    return res.data.data;
  },

  /** 🧩 3️⃣ Lấy hội thoại trực tiếp (1-1) với user cụ thể */
  async getDirectConversation(userId: string): Promise<ConversationDto> {
    const res = await http.get(`/conversation/direct/${userId}`);
    return res.data.data || res.data;
  },

  /** 🧩 4️⃣ Lấy chi tiết một hội thoại (bao gồm tin nhắn gần nhất, participants, ...) */
  async getConversationById(id: string): Promise<ConversationWithMessagesDto> {
    const res = await http.get(`/conversation/${id}`);
    return res.data.data || res.data;
  },

  /** 🧩 5️⃣ Lấy danh sách tin nhắn trong hội thoại (phân trang nếu có) */
  async getMessages(id: string, params?: { cursor?: string; limit?: number }): Promise<MessagesListDto> {
    const res = await http.get(`/conversation/${id}/messages`, { params });
    return res.data.data;
  },

  /** 🧩 6️⃣ Gửi tin nhắn mới vào hội thoại */
  async sendMessage(id: string, data: SendMessageDto): Promise<MessageDto> {
    const res = await http.post(`/conversation/${id}/messages`, data);
    return res.data.data || res.data;
  },

  /** 🧩 7️⃣ Thêm thành viên mới vào group chat */
  async addParticipants(id: string, data: AddParticipantDto): Promise<ConversationParticipantDto> {
    const res = await http.post(`/conversation/${id}/participants`, data);
    return res.data.data || res.data;
  },

  /** 🧩 8️⃣ Xóa thành viên ra khỏi group chat */
  async removeParticipant(id: string, participantId: string): Promise<{ success: boolean }> {
    const res = await http.delete(`/conversation/${id}/participants/${participantId}`);
    return res.data.data || res.data;
  },

  /** 🧩 9️⃣ Chỉnh sửa tin nhắn */
  async editMessage(conversationId: string, messageId: string, data: { content: string }): Promise<MessageDto> {
    const res = await http.patch(`/conversation/${conversationId}/messages/${messageId}`, data);
    return res.data.data || res.data;
  },

  /** 🧩 🔟 Xóa tin nhắn */
  async deleteMessage(conversationId: string, messageId: string): Promise<boolean> {
    const res = await http.delete(`/conversation/${conversationId}/messages/${messageId}`);
    return res.data.data || res.data;
  },

  /** 🧩 1️⃣1️⃣ Xóa hội thoại */
  async deleteConversation(conversationId: string): Promise<boolean> {
    const res = await http.delete(`/conversation/${conversationId}`);
    return res.data.data || res.data;
  },

  /** 🧩 1️⃣2️⃣ Đánh dấu tin nhắn đã đọc */
  async markMessageAsRead(conversationId: string, messageId: string): Promise<boolean> {
    const res = await http.post(`/conversation/${conversationId}/messages/${messageId}/read`);
    return res.data.data || res.data;
  },
};
