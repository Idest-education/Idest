import { Test, TestingModule } from '@nestjs/testing';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { Role } from 'src/common/enums/role.enum';
import { userPayload } from 'src/common/types/userPayload.interface';

const mockService = {
  createConversation: jest.fn(),
  getUserConversations: jest.fn(),
  getOrCreateDirectConversation: jest.fn(),
  getConversationById: jest.fn(),
  getConversationMessages: jest.fn(),
  sendMessage: jest.fn(),
  addParticipant: jest.fn(),
  deleteConversation: jest.fn(),
  updateConversation: jest.fn(),
  removeParticipant: jest.fn(),
};

const user: userPayload = {
  id: 'user-1',
  email: 'user@test.com',
  full_name: 'User One',
  role: Role.STUDENT,
  avatar: '',
};

describe('ConversationController', () => {
  let controller: ConversationController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: ConversationService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(AuthGuard).useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ConversationController>(ConversationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createConversation', () => {
    it('delegates to ConversationService.createConversation', async () => {
      const dto = { isGroup: false, participantIds: ['user-2'] };
      const expected = {
        id: 'conv-1',
        isGroup: false,
        title: null,
        avatar_url: null,
        classId: null,
        createdBy: 'user-1',
        ownerId: 'user-1',
        isDeleted: false,
        participants: [],
      };

      mockService.createConversation.mockResolvedValue(expected);

      const result = await controller.createConversation(user, dto as any);

      expect(mockService.createConversation).toHaveBeenCalledWith(user, dto);
      expect(result).toBe(expected);
    });
  });

  describe('getUserConversations', () => {
    it('calls service with default limit when cursor and limit are not provided', async () => {
      const expected = {
        conversations: [],
        nextCursor: null,
      };

      mockService.getUserConversations.mockResolvedValue(expected);

      const result = await controller.getUserConversations(user);

      expect(mockService.getUserConversations).toHaveBeenCalledWith(user.id, {
        cursor: undefined,
        limit: 50,
      });
      expect(result).toBe(expected);
    });

    it('calls service with parsed limit when provided', async () => {
      const expected = {
        conversations: [],
        nextCursor: null,
      };

      mockService.getUserConversations.mockResolvedValue(expected);

      const result = await controller.getUserConversations(user, undefined, '30');

      expect(mockService.getUserConversations).toHaveBeenCalledWith(user.id, {
        cursor: undefined,
        limit: 30,
      });
      expect(result).toBe(expected);
    });

    it('calls service with cursor and parsed limit when both provided', async () => {
      const expected = {
        conversations: [],
        nextCursor: null,
      };

      mockService.getUserConversations.mockResolvedValue(expected);

      const result = await controller.getUserConversations(
        user,
        'cursor-123',
        '20',
      );

      expect(mockService.getUserConversations).toHaveBeenCalledWith(user.id, {
        cursor: 'cursor-123',
        limit: 20,
      });
      expect(result).toBe(expected);
    });
  });

  describe('getOrCreateDirectConversation', () => {
    it('delegates to ConversationService.getOrCreateDirectConversation', async () => {
      const otherUserId = 'user-2';
      const expected = {
        id: 'conv-1',
        isGroup: false,
        title: null,
        avatar_url: null,
        classId: null,
        createdBy: 'user-1',
        ownerId: 'user-1',
        isDeleted: false,
        participants: [],
      };

      mockService.getOrCreateDirectConversation.mockResolvedValue(expected);

      const result = await controller.getOrCreateDirectConversation(
        otherUserId,
        user,
      );

      expect(
        mockService.getOrCreateDirectConversation,
      ).toHaveBeenCalledWith(user.id, otherUserId);
      expect(result).toBe(expected);
    });
  });

  describe('getConversationById', () => {
    it('calls service with default messageLimit when limit and before are not provided', async () => {
      const conversationId = 'conv-1';
      const expected = {
        id: conversationId,
        isGroup: false,
        title: null,
        avatar_url: null,
        classId: null,
        createdBy: 'user-1',
        ownerId: 'user-1',
        isDeleted: false,
        participants: [],
        messages: [],
      };

      mockService.getConversationById.mockResolvedValue(expected);

      const result = await controller.getConversationById(conversationId, user);

      expect(mockService.getConversationById).toHaveBeenCalledWith(
        conversationId,
        user.id,
        50,
        undefined,
      );
      expect(result).toBe(expected);
    });

    it('calls service with parsed limit when provided', async () => {
      const conversationId = 'conv-1';
      const expected = {
        id: conversationId,
        isGroup: false,
        title: null,
        avatar_url: null,
        classId: null,
        createdBy: 'user-1',
        ownerId: 'user-1',
        isDeleted: false,
        participants: [],
        messages: [],
      };

      mockService.getConversationById.mockResolvedValue(expected);

      const result = await controller.getConversationById(
        conversationId,
        user,
        '30',
      );

      expect(mockService.getConversationById).toHaveBeenCalledWith(
        conversationId,
        user.id,
        30,
        undefined,
      );
      expect(result).toBe(expected);
    });

    it('calls service with parsed limit and beforeDate when both provided', async () => {
      const conversationId = 'conv-1';
      const beforeString = '2025-01-01T00:00:00.000Z';
      const beforeDate = new Date(beforeString);
      const expected = {
        id: conversationId,
        isGroup: false,
        title: null,
        avatar_url: null,
        classId: null,
        createdBy: 'user-1',
        ownerId: 'user-1',
        isDeleted: false,
        participants: [],
        messages: [],
      };

      mockService.getConversationById.mockResolvedValue(expected);

      const result = await controller.getConversationById(
        conversationId,
        user,
        '30',
        beforeString,
      );

      expect(mockService.getConversationById).toHaveBeenCalledWith(
        conversationId,
        user.id,
        30,
        beforeDate,
      );
      expect(result).toBe(expected);
    });
  });

  describe('getConversationMessages', () => {
    it('calls service with default messageLimit and undefined beforeDate', async () => {
      const conversationId = 'conv-1';
      const expected = {
        messages: [],
        nextCursor: null,
      };

      mockService.getConversationMessages.mockResolvedValue(expected);

      const result = await controller.getConversationMessages(
        conversationId,
        user,
      );

      expect(mockService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        user.id,
        50,
        undefined,
      );
      expect(result).toBe(expected);
    });

    it('calls service with parsed limit when provided', async () => {
      const conversationId = 'conv-1';
      const expected = {
        messages: [],
        nextCursor: null,
      };

      mockService.getConversationMessages.mockResolvedValue(expected);

      const result = await controller.getConversationMessages(
        conversationId,
        user,
        '25',
      );

      expect(mockService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        user.id,
        25,
        undefined,
      );
      expect(result).toBe(expected);
    });

    it('calls service with parsed limit and beforeDate when both provided', async () => {
      const conversationId = 'conv-1';
      const beforeString = '2025-02-01T12:00:00.000Z';
      const beforeDate = new Date(beforeString);
      const expected = {
        messages: [],
        nextCursor: null,
      };

      mockService.getConversationMessages.mockResolvedValue(expected);

      const result = await controller.getConversationMessages(
        conversationId,
        user,
        '40',
        beforeString,
      );

      expect(mockService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        user.id,
        40,
        beforeDate,
      );
      expect(result).toBe(expected);
    });

    it('ignores cursor parameter and passes it to service correctly', async () => {
      const conversationId = 'conv-1';
      const expected = {
        messages: [],
        nextCursor: null,
      };

      mockService.getConversationMessages.mockResolvedValue(expected);

      const result = await controller.getConversationMessages(
        conversationId,
        user,
        '50',
        undefined,
        'cursor-456',
      );

      expect(mockService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        user.id,
        50,
        undefined,
      );
      expect(result).toBe(expected);
    });
  });

  describe('sendMessage', () => {
    it('delegates to ConversationService.sendMessage', async () => {
      const conversationId = 'conv-1';
      const dto = { content: 'Hello', replyToId: null, attachments: [] };
      const expected = {
        id: 'msg-1',
        conversationId,
        senderId: user.id,
        content: 'Hello',
        createdAt: new Date(),
        replyToId: null,
        attachments: [],
      };

      mockService.sendMessage.mockResolvedValue(expected);

      const result = await controller.sendMessage(conversationId, user, dto as any);

      expect(mockService.sendMessage).toHaveBeenCalledWith(
        conversationId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('addParticipant', () => {
    it('delegates to ConversationService.addParticipant', async () => {
      const conversationId = 'conv-1';
      const dto = { userId: 'user-2' };
      const expected = {
        id: 'part-1',
        userId: 'user-2',
        conversationId,
        user: {
          id: 'user-2',
          full_name: 'User Two',
          email: 'user2@test.com',
          avatar_url: null,
        },
      };

      mockService.addParticipant.mockResolvedValue(expected);

      const result = await controller.addParticipant(conversationId, user, dto as any);

      expect(mockService.addParticipant).toHaveBeenCalledWith(
        conversationId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('deleteConversation', () => {
    it('delegates to ConversationService.deleteConversation', async () => {
      const conversationId = 'conv-1';

      mockService.deleteConversation.mockResolvedValue(true);

      const result = await controller.deleteConversation(conversationId, user);

      expect(mockService.deleteConversation).toHaveBeenCalledWith(
        conversationId,
        user.id,
      );
      expect(result).toBe(true);
    });
  });

  describe('updateConversation', () => {
    it('delegates to ConversationService.updateConversation', async () => {
      const conversationId = 'conv-1';
      const dto = { title: 'New Title', avatar_url: 'https://example.com/avatar.jpg' };
      const expected = {
        id: conversationId,
        isGroup: true,
        title: 'New Title',
        avatar_url: 'https://example.com/avatar.jpg',
        classId: null,
        createdBy: 'user-1',
        ownerId: 'user-1',
        isDeleted: false,
        participants: [],
      };

      mockService.updateConversation.mockResolvedValue(expected);

      const result = await controller.updateConversation(conversationId, user, dto as any);

      expect(mockService.updateConversation).toHaveBeenCalledWith(
        conversationId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('removeParticipant', () => {
    it('delegates to ConversationService.removeParticipant', async () => {
      const conversationId = 'conv-1';
      const participantId = 'user-2';

      mockService.removeParticipant.mockResolvedValue(true);

      const result = await controller.removeParticipant(
        conversationId,
        participantId,
        user,
      );

      expect(mockService.removeParticipant).toHaveBeenCalledWith(
        conversationId,
        user.id,
        participantId,
      );
      expect(result).toBe(true);
    });
  });
});
