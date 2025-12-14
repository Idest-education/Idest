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
  UpdateConversationDto,
} from "@/types/conversation";

// 💬 Conversation API Service (Frontend)
export const conversationService = {
  /** 🧩 1️⃣ Tạo hội thoại mới (group hoặc direct) */
  async createConversation(
    data: CreateConversationDto,
  ): Promise<ConversationDto> {
    const res = await http.post("/conversation", data);
    return res.data.data ?? res.data;
  },

  /** 🧩 2️⃣ Lấy danh sách hội thoại của user hiện tại */
  async getUserConversations(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<ConversationsListDto> {
    const res = await http.get("/conversation", { params });
    return res.data.data ?? res.data;
  },

  /** 🧩 3️⃣ Lấy hội thoại trực tiếp (1-1) với user cụ thể */
  async getDirectConversation(userId: string): Promise<ConversationDto> {
    const res = await http.get(`/conversation/direct/${userId}`);
    return res.data.data ?? res.data;
  },

  /** 🧩 4️⃣ Lấy chi tiết một hội thoại (bao gồm tin nhắn gần nhất, participants, ...) */
  async getConversationById(
    id: string,
    params?: { limit?: number; before?: string | Date },
  ): Promise<ConversationWithMessagesDto> {
    const res = await http.get(`/conversation/${id}`, {
      params: {
        ...params,
        before:
          params?.before instanceof Date ? params.before.toISOString() : params?.before,
      },
    });
    return res.data.data ?? res.data;
  },

  /** 🧩 5️⃣ Lấy danh sách tin nhắn trong hội thoại (phân trang nếu có) */
  async getMessages(
    id: string,
    params?: { limit?: number; before?: string | Date },
  ): Promise<MessagesListDto> {
    const res = await http.get(`/conversation/${id}/messages`, {
      params: {
        ...params,
        before:
          params?.before instanceof Date ? params.before.toISOString() : params?.before,
      },
    });
    return res.data.data ?? res.data;
  },

  /** 🧩 6️⃣ Gửi tin nhắn mới vào hội thoại */
  async sendMessage(id: string, data: SendMessageDto): Promise<MessageDto> {
    const res = await http.post(`/conversation/${id}/messages`, data);
    return res.data.data ?? res.data;
  },

  /** 🧩 7️⃣ Thêm thành viên mới vào group chat */
  async addParticipant(
    id: string,
    data: AddParticipantDto,
  ): Promise<ConversationParticipantDto> {
    const res = await http.post(`/conversation/${id}/participants`, data);
    return res.data.data ?? res.data;
  },

  /** 🧩 8️⃣ Xóa thành viên ra khỏi group chat */
  async removeParticipant(id: string, participantId: string): Promise<boolean> {
    const res = await http.delete(`/conversation/${id}/participants/${participantId}`);
    return res.data.data ?? res.data;
  },

  /** 🧩 9️⃣ Xóa cuộc hội thoại */
  async deleteConversation(id: string): Promise<boolean> {
    const res = await http.delete(`/conversation/${id}`);
    return res.data.data ?? res.data;
  },

  /** 🧩 🔟 Cập nhật hội thoại (group only): title / avatar_url */
  async updateConversation(
    id: string,
    data: UpdateConversationDto,
  ): Promise<ConversationDto> {
    const res = await http.patch(`/conversation/${id}`, data);
    return res.data.data ?? res.data;
  },
};
