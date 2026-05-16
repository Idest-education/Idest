import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConversationGateway } from './conversation.gateway';
import { MessageType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock the util module so checkClassAccess / getClassConversationParticipants
// are fully under test control.
// ---------------------------------------------------------------------------
jest.mock('./conversation.util', () => ({
  checkClassAccess: jest.fn(),
  getClassConversationParticipants: jest.fn(),
}));

import {
  checkClassAccess,
  getClassConversationParticipants,
} from './conversation.util';

const mockCheckClassAccess = checkClassAccess as jest.Mock;
const mockGetClassConversationParticipants =
  getClassConversationParticipants as jest.Mock;

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------
const mockPrisma = {
  conversation: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  conversationParticipant: {
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Gateway mock
// ---------------------------------------------------------------------------
const mockGateway = {
  emitConversationCreated: jest.fn().mockResolvedValue(undefined),
  emitNewMessage: jest.fn().mockResolvedValue(undefined),
  emitParticipantAdded: jest.fn().mockResolvedValue(undefined),
  emitParticipantRemoved: jest.fn().mockResolvedValue(undefined),
  emitConversationDeleted: jest.fn().mockResolvedValue(undefined),
  emitConversationUpdated: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------
const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'user@test.com',
  full_name: 'Test User',
  ...overrides,
});

const makeConversation = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-1',
  isGroup: false,
  title: null,
  avatar_url: null,
  classId: null,
  createdBy: 'user-1',
  ownerId: 'user-1',
  isDeleted: false,
  updatedAt: new Date(),
  participants: [],
  messages: [],
  ...overrides,
});

const makeParticipant = (overrides: Record<string, unknown> = {}) => ({
  id: 'part-1',
  userId: 'user-1',
  conversationId: 'conv-1',
  user: {
    id: 'user-1',
    full_name: 'Test User',
    email: 'user@test.com',
    avatar_url: null,
  },
  ...overrides,
});

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg-1',
  content: 'Hello',
  senderId: 'user-1',
  conversationId: 'conv-1',
  type: MessageType.DIRECT,
  sentAt: new Date(),
  sender: {
    id: 'user-1',
    full_name: 'Test User',
    avatar_url: null,
  },
  conversation: { id: 'conv-1', isGroup: false },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConversationGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
  });

  // =========================================================================
  // createConversation
  // =========================================================================
  describe('createConversation', () => {
    it('returns existing conversation when a direct chat already exists (dedup)', async () => {
      const existing = makeConversation();
      // findExistingDirectConversation uses conversation.findFirst
      mockPrisma.conversation.findFirst.mockResolvedValue(existing);

      const user = makeUser();
      const dto = { isGroup: false, participantIds: ['user-2'] };

      const result = await service.createConversation(user as any, dto as any);

      expect(result).toEqual(existing);
      // Should NOT proceed to conversation.create
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates a new direct conversation when none exists', async () => {
      // No existing direct conversation
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      const created = makeConversation({ id: 'conv-new' });
      mockPrisma.conversation.create.mockResolvedValue(created);
      mockPrisma.conversationParticipant.createMany.mockResolvedValue({ count: 2 });

      const full = makeConversation({
        id: 'conv-new',
        participants: [makeParticipant(), makeParticipant({ userId: 'user-2' })],
      });
      mockPrisma.conversation.findUnique.mockResolvedValue(full);

      const user = makeUser();
      const dto = { isGroup: false, participantIds: ['user-2'] };

      const result = await service.createConversation(user as any, dto as any);

      expect(mockPrisma.conversation.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.conversationParticipant.createMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual(full);
      expect(mockGateway.emitConversationCreated).toHaveBeenCalledWith(full);
    });

    it('creates a group conversation with class participants', async () => {
      // No existing direct conversation check (dto.isGroup, so the dedup block is skipped)
      mockCheckClassAccess.mockResolvedValue(true);
      // No existing class conversation
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      const created = makeConversation({ id: 'conv-class', classId: 'class-1', isGroup: true });
      mockPrisma.conversation.create.mockResolvedValue(created);

      const classParticipants = [
        { userId: 'user-1', conversationId: 'conv-class' },
        { userId: 'user-3', conversationId: 'conv-class' },
      ];
      mockGetClassConversationParticipants.mockResolvedValue(classParticipants);
      mockPrisma.conversationParticipant.createMany.mockResolvedValue({ count: 2 });

      const full = makeConversation({
        id: 'conv-class',
        classId: 'class-1',
        isGroup: true,
        participants: [makeParticipant(), makeParticipant({ userId: 'user-3' })],
      });
      mockPrisma.conversation.findUnique.mockResolvedValue(full);

      const user = makeUser();
      const dto = { isGroup: true, participantIds: [], classId: 'class-1' };

      const result = await service.createConversation(user as any, dto as any);

      expect(mockCheckClassAccess).toHaveBeenCalledWith(mockPrisma, 'class-1', 'user-1');
      expect(mockGetClassConversationParticipants).toHaveBeenCalledWith(
        mockPrisma,
        'class-1',
        'conv-class',
      );
      expect(result).toEqual(full);
    });

    it('throws ForbiddenException when user has no class access', async () => {
      mockCheckClassAccess.mockResolvedValue(false);

      const user = makeUser();
      const dto = { isGroup: true, participantIds: [], classId: 'class-1' };

      await expect(
        service.createConversation(user as any, dto as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // getUserConversations
  // =========================================================================
  describe('getUserConversations', () => {
    it('returns conversations with nextCursor when result count equals limit', async () => {
      const limit = 2;
      const convs = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })];
      mockPrisma.conversation.findMany.mockResolvedValue(convs);

      const result = await service.getUserConversations('user-1', { limit });

      expect(result.items).toEqual(convs);
      expect(result.nextCursor).toBe('c2');
    });

    it('returns conversations with no nextCursor when fewer than limit', async () => {
      const limit = 10;
      const convs = [makeConversation({ id: 'c1' })];
      mockPrisma.conversation.findMany.mockResolvedValue(convs);

      const result = await service.getUserConversations('user-1', { limit });

      expect(result.items).toEqual(convs);
      expect(result.nextCursor).toBeUndefined();
    });

    it('passes cursor and skip args to findMany when cursor is provided', async () => {
      const convs = [makeConversation({ id: 'c2' })];
      mockPrisma.conversation.findMany.mockResolvedValue(convs);

      await service.getUserConversations('user-1', { cursor: 'cursor-id', limit: 10 });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'cursor-id' }, skip: 1 }),
      );
    });
  });

  // =========================================================================
  // getConversationById
  // =========================================================================
  describe('getConversationById', () => {
    it('returns conversation with messages when user is a participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(makeParticipant());

      const messages = [makeMessage({ id: 'msg-1' }), makeMessage({ id: 'msg-2' })];
      const conv = makeConversation({ messages });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);

      const result = await service.getConversationById('conv-1', 'user-1', 50);

      expect(result.conversation).toEqual(conv);
    });

    it('throws ForbiddenException when user is not a participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.getConversationById('conv-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when conversation is not found after access check', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(makeParticipant());
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      await expect(
        service.getConversationById('conv-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when conversation has classId and checkClassAccess returns false', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(makeParticipant());
      const conv = makeConversation({ classId: 'class-1', messages: [] });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);
      mockCheckClassAccess.mockResolvedValue(false);

      await expect(
        service.getConversationById('conv-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);

      const thrownError = await service
        .getConversationById('conv-1', 'user-1')
        .catch((e) => e);
      expect(thrownError.message).toBe('Access denied to this class conversation');
    });
  });

  // =========================================================================
  // sendMessage
  // =========================================================================
  describe('sendMessage', () => {
    it('creates message with type DIRECT when classId is null', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(makeParticipant());
      mockPrisma.conversation.findUnique.mockResolvedValue(
        makeConversation({ isDeleted: false, classId: null }),
      );
      const msg = makeMessage({ type: MessageType.DIRECT });
      mockPrisma.message.create.mockResolvedValue(msg);
      mockPrisma.conversation.update.mockResolvedValue({});

      const dto = { content: 'Hello' };
      const result = await service.sendMessage('conv-1', 'user-1', dto as any);

      expect(result.type).toBe(MessageType.DIRECT);
      expect(mockGateway.emitNewMessage).toHaveBeenCalledWith('conv-1', msg);
    });

    it('creates message with type CLASSROOM when classId is set', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(makeParticipant());
      mockPrisma.conversation.findUnique.mockResolvedValue(
        makeConversation({ isDeleted: false, classId: 'class-1' }),
      );
      const msg = makeMessage({ type: MessageType.CLASSROOM });
      mockPrisma.message.create.mockResolvedValue(msg);
      mockPrisma.conversation.update.mockResolvedValue({});

      const dto = { content: 'Class message' };
      const result = await service.sendMessage('conv-1', 'user-1', dto as any);

      expect(result.type).toBe(MessageType.CLASSROOM);
    });

    it('throws ForbiddenException when user is not a participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('conv-1', 'user-1', { content: 'Hi' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when conversation is deleted', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(makeParticipant());
      mockPrisma.conversation.findUnique.mockResolvedValue(
        makeConversation({ isDeleted: true }),
      );

      await expect(
        service.sendMessage('conv-1', 'user-1', { content: 'Hi' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // addParticipant
  // =========================================================================
  describe('addParticipant', () => {
    it('adds participant to group conversation successfully', async () => {
      const conv = makeConversation({
        isGroup: true,
        participants: [makeParticipant({ userId: 'user-1' })],
      });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);

      const newParticipant = makeParticipant({ id: 'part-2', userId: 'user-2' });
      mockPrisma.conversationParticipant.create.mockResolvedValue(newParticipant);

      const dto = { userId: 'user-2' };
      const result = await service.addParticipant('conv-1', 'user-1', dto as any);

      expect(result).toEqual(newParticipant);
      expect(mockGateway.emitParticipantAdded).toHaveBeenCalledWith('conv-1', newParticipant);
    });

    it('throws ForbiddenException when conversation is not a group', async () => {
      const conv = makeConversation({
        isGroup: false,
        participants: [makeParticipant({ userId: 'user-1' })],
      });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);

      await expect(
        service.addParticipant('conv-1', 'user-1', { userId: 'user-2' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller is not a participant', async () => {
      const conv = makeConversation({
        isGroup: true,
        participants: [makeParticipant({ userId: 'user-other' })],
      });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);

      await expect(
        service.addParticipant('conv-1', 'user-1', { userId: 'user-2' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when user is already a participant', async () => {
      const conv = makeConversation({
        isGroup: true,
        participants: [
          makeParticipant({ userId: 'user-1' }),
          makeParticipant({ userId: 'user-2' }),
        ],
      });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);

      await expect(
        service.addParticipant('conv-1', 'user-1', { userId: 'user-2' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // removeParticipant
  // =========================================================================
  describe('removeParticipant', () => {
    it('removes participant successfully', async () => {
      const part = makeParticipant({ userId: 'user-2' });
      const conv = makeConversation({
        participants: [makeParticipant({ userId: 'user-1' }), part],
      });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(part);
      mockPrisma.conversationParticipant.delete.mockResolvedValue({});
      // Remaining participants > 0
      mockPrisma.conversationParticipant.count.mockResolvedValue(1);

      const result = await service.removeParticipant('conv-1', 'user-1', 'user-2');

      expect(result).toBe(true);
      expect(mockGateway.emitParticipantRemoved).toHaveBeenCalledWith('conv-1', 'user-2');
    });

    it('soft-deletes conversation when last participant is removed', async () => {
      const part = makeParticipant({ userId: 'user-1' });
      const conv = makeConversation({
        participants: [part],
      });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(part);
      mockPrisma.conversationParticipant.delete.mockResolvedValue({});
      // No remaining participants
      mockPrisma.conversationParticipant.count.mockResolvedValue(0);
      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await service.removeParticipant('conv-1', 'user-1', 'user-1');

      expect(result).toBe(true);
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { isDeleted: true },
      });
      expect(mockGateway.emitConversationDeleted).toHaveBeenCalledWith('conv-1');
    });

    it('throws ForbiddenException when caller is neither the user nor creator', async () => {
      const part = makeParticipant({ userId: 'user-3' });
      // participants[0].userId is 'user-2', so user-1 is not the creator
      const conv = makeConversation({
        participants: [makeParticipant({ userId: 'user-2' }), part],
      });
      mockPrisma.conversation.findFirst.mockResolvedValue(conv);

      // user-1 is not removing themselves (user-3) and is not the creator (user-2)
      await expect(
        service.removeParticipant('conv-1', 'user-1', 'user-3'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // deleteConversation
  // =========================================================================
  describe('deleteConversation', () => {
    it('deletes direct conversation for any participant', async () => {
      const conv = makeConversation({ isGroup: false, createdBy: 'user-2', ownerId: 'user-2' });
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'part-1' });
      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await service.deleteConversation('conv-1', 'user-1');

      expect(result).toBe(true);
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { isDeleted: true },
      });
      expect(mockGateway.emitConversationDeleted).toHaveBeenCalledWith('conv-1');
    });

    it('throws ForbiddenException when non-creator tries to delete a group conversation', async () => {
      const conv = makeConversation({
        isGroup: true,
        createdBy: 'user-2',
        ownerId: 'user-2',
      });
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'part-1' });

      await expect(
        service.deleteConversation('conv-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when conversation not found', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteConversation('conv-bad', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when conversation is already deleted', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        isDeleted: true,
        isGroup: false,
        createdBy: 'user-1',
        ownerId: 'user-1',
      });

      await expect(
        service.deleteConversation('conv-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // updateConversation
  // =========================================================================
  describe('updateConversation', () => {
    it('updates group conversation title when caller is creator', async () => {
      const conv = makeConversation({ isGroup: true, createdBy: 'user-1', ownerId: 'user-1' });
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'part-1' });

      const updated = makeConversation({ isGroup: true, title: 'New Title' });
      mockPrisma.conversation.update.mockResolvedValue(updated);

      const dto = { title: 'New Title' };
      const result = await service.updateConversation('conv-1', 'user-1', dto as any);

      expect(result).toEqual(updated);
      expect(mockGateway.emitConversationUpdated).toHaveBeenCalledWith(updated);
    });

    it('throws ForbiddenException when conversation is not a group', async () => {
      const conv = makeConversation({ isGroup: false });
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);

      await expect(
        service.updateConversation('conv-1', 'user-1', { title: 'X' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller is not creator/owner', async () => {
      const conv = makeConversation({
        isGroup: true,
        createdBy: 'user-2',
        ownerId: 'user-2',
      });
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'part-1' });

      await expect(
        service.updateConversation('conv-1', 'user-1', { title: 'X' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when conversation is already deleted', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        isDeleted: true,
        isGroup: true,
        createdBy: 'user-1',
        ownerId: 'user-1',
      });

      await expect(
        service.updateConversation('conv-1', 'user-1', { title: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getConversationMessages
  // =========================================================================
  describe('getConversationMessages', () => {
    it('returns messages list when user is a participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(makeParticipant());
      const messages = [makeMessage({ id: 'msg-1' }), makeMessage({ id: 'msg-2' })];
      mockPrisma.message.findMany.mockResolvedValue(messages);

      const result = await service.getConversationMessages('conv-1', 'user-1');

      expect(result.messages).toBeDefined();
      expect(mockPrisma.message.findMany).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when user is not a participant', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.getConversationMessages('conv-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // getOrCreateDirectConversation
  // =========================================================================
  describe('getOrCreateDirectConversation', () => {
    it('returns existing conversation when one exists between the two users', async () => {
      const existing = makeConversation({ id: 'conv-existing' });
      mockPrisma.conversation.findFirst.mockResolvedValue(existing);

      const result = await service.getOrCreateDirectConversation('user-1', 'user-2');

      expect(result).toEqual(existing);
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates a new conversation when none exists', async () => {
      // findFirst called twice: once by getOrCreateDirectConversation → findExistingDirectConversation,
      // then again inside createConversation → findExistingDirectConversation
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      const created = makeConversation({ id: 'conv-new' });
      mockPrisma.conversation.create.mockResolvedValue(created);
      mockPrisma.conversationParticipant.createMany.mockResolvedValue({ count: 2 });

      const full = makeConversation({
        id: 'conv-new',
        participants: [makeParticipant(), makeParticipant({ userId: 'user-2' })],
      });
      mockPrisma.conversation.findUnique.mockResolvedValue(full);

      const result = await service.getOrCreateDirectConversation('user-1', 'user-2');

      expect(mockPrisma.conversation.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(full);
    });
  });
});
