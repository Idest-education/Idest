import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { userPayload } from 'src/common/types/userPayload.interface';
import { ResponseDto } from 'src/common/dto/response.dto';
import {
  CreateConversationDto,
  AddParticipantDto,
} from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new conversation (1-on-1 or group)
   */
  async createConversation(
    user: userPayload,
    dto: CreateConversationDto,
  ): Promise<ResponseDto> {
    try {
      // For 1-on-1 conversations, check if one already exists
      if (!dto.isGroup && dto.participantIds.length === 1) {
        const otherUserId = dto.participantIds[0];
        const existing = await this.findExistingDirectConversation(
          user.id,
          otherUserId,
        );
        if (existing) {
          return ResponseDto.ok(existing, 'Direct conversation already exists');
        }
      }

      // Create conversation
      const conversation = await this.prisma.conversation.create({
        data: {
          isGroup: dto.isGroup || false,
        },
      });

      // Add creator as participant
      await this.prisma.conversationParticipant.create({
        data: {
          userId: user.id,
          conversationId: conversation.id,
        },
      });

      // Add other participants
      const participantData = dto.participantIds.map((userId) => ({
        userId,
        conversationId: conversation.id,
      }));

      await this.prisma.conversationParticipant.createMany({
        data: participantData,
        skipDuplicates: true,
      });

      // Return conversation with participants
      const fullConversation = await this.prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
                  avatar_url: true,
                },
              },
            },
          },
          messages: {
            take: 10,
            orderBy: { sentAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  full_name: true,
                  avatar_url: true,
                },
              },
            },
          },
        },
      });

      return ResponseDto.ok(
        fullConversation,
        'Conversation created successfully',
      );
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId: string): Promise<ResponseDto> {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: {
          participants: {
            some: { userId },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
                  avatar_url: true,
                },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  full_name: true,
                },
              },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return ResponseDto.ok(
        conversations,
        'Conversations retrieved successfully',
      );
    } catch (error) {
      console.error('Error getting user conversations:', error);
      throw new Error('Failed to retrieve conversations');
    }
  }

  /**
   * Get conversation by ID with messages
   */
  async getConversationById(
    conversationId: string,
    userId: string,
    limit: number = 50,
    before?: Date,
  ): Promise<ResponseDto> {
    try {
      // Check if user is participant
      const isParticipant =
        await this.prisma.conversationParticipant.findUnique({
          where: {
            userId_conversationId: {
              userId,
              conversationId,
            },
          },
        });

      if (!isParticipant) {
        throw new ForbiddenException('Access denied to this conversation');
      }

      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
                  avatar_url: true,
                },
              },
            },
          },
          messages: {
            where: before ? { sentAt: { lt: before } } : {},
            take: limit,
            orderBy: { sentAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  full_name: true,
                  avatar_url: true,
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Reverse messages to get chronological order
      conversation.messages.reverse();

      return ResponseDto.ok(
        conversation,
        'Conversation retrieved successfully',
      );
    } catch (error) {
      console.error('Error getting conversation:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to retrieve conversation');
    }
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<ResponseDto> {
    try {
      // Check if user is participant
      const isParticipant =
        await this.prisma.conversationParticipant.findUnique({
          where: {
            userId_conversationId: {
              userId,
              conversationId,
            },
          },
        });

      if (!isParticipant) {
        throw new ForbiddenException(
          'You are not a participant in this conversation',
        );
      }

      // Create message
      const message = await this.prisma.message.create({
        data: {
          content: dto.content,
          senderId: userId,
          conversationId,
          type: 'DIRECT',
        },
        include: {
          sender: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
            },
          },
          conversation: {
            select: {
              id: true,
              isGroup: true,
            },
          },
        },
      });

      // Update conversation's updatedAt
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return ResponseDto.ok(message, 'Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error('Failed to send message');
    }
  }

  /**
   * Add participant to group conversation
   */
  async addParticipant(
    conversationId: string,
    userId: string,
    dto: AddParticipantDto,
  ): Promise<ResponseDto> {
    try {
      // Check if conversation exists and is a group
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: true,
        },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (!conversation.isGroup) {
        throw new ForbiddenException(
          'Cannot add participants to direct conversations',
        );
      }

      // Check if requester is a participant
      const isParticipant = conversation.participants.some(
        (p) => p.userId === userId,
      );
      if (!isParticipant) {
        throw new ForbiddenException('Only participants can add new members');
      }

      // Check if user is already a participant
      const alreadyParticipant = conversation.participants.some(
        (p) => p.userId === dto.userId,
      );
      if (alreadyParticipant) {
        throw new ConflictException('User is already a participant');
      }

      // Add participant
      const participant = await this.prisma.conversationParticipant.create({
        data: {
          userId: dto.userId,
          conversationId,
        },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
            },
          },
        },
      });

      return ResponseDto.ok(participant, 'Participant added successfully');
    } catch (error) {
      console.error('Error adding participant:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new Error('Failed to add participant');
    }
  }

  /**
   * Remove participant from conversation
   */
  async removeParticipant(
    conversationId: string,
    userId: string,
    participantId: string,
  ): Promise<ResponseDto> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: true,
        },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Users can only remove themselves, or in group chats, the first participant (creator) can remove others
      const isOwnProfile = userId === participantId;
      const isCreator = conversation.participants[0]?.userId === userId;

      if (!isOwnProfile && !isCreator) {
        throw new ForbiddenException(
          'You can only remove yourself or, as creator, remove others',
        );
      }

      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          userId_conversationId: {
            userId: participantId,
            conversationId,
          },
        },
      });

      if (!participant) {
        throw new NotFoundException(
          'Participant not found in this conversation',
        );
      }

      await this.prisma.conversationParticipant.delete({
        where: { id: participant.id },
      });

      // If this was the last participant, delete the conversation
      const remainingParticipants =
        await this.prisma.conversationParticipant.count({
          where: { conversationId },
        });

      if (remainingParticipants === 0) {
        await this.prisma.conversation.delete({
          where: { id: conversationId },
        });
        return ResponseDto.ok(
          null,
          'Conversation deleted as no participants remain',
        );
      }

      return ResponseDto.ok(null, 'Participant removed successfully');
    } catch (error) {
      console.error('Error removing participant:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to remove participant');
    }
  }

  /**
   * Get or create direct conversation between two users
   */
  async getOrCreateDirectConversation(
    userId: string,
    otherUserId: string,
  ): Promise<ResponseDto> {
    try {
      // Check if conversation already exists
      const existing = await this.findExistingDirectConversation(
        userId,
        otherUserId,
      );
      if (existing) {
        return ResponseDto.ok(existing, 'Direct conversation found');
      }

      // Create new conversation
      const dto: CreateConversationDto = {
        isGroup: false,
        participantIds: [otherUserId],
      };

      return this.createConversation({ id: userId } as userPayload, dto);
    } catch (error) {
      console.error('Error getting or creating direct conversation:', error);
      throw new Error('Failed to get or create conversation');
    }
  }

  /**
   * Helper: Find existing direct conversation between two users
   */
  private async findExistingDirectConversation(
    userId1: string,
    userId2: string,
  ) {
    return this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        participants: {
          every: {
            userId: { in: [userId1, userId2] },
          },
        },
        AND: [
          { participants: { some: { userId: userId1 } } },
          { participants: { some: { userId: userId2 } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                avatar_url: true,
              },
            },
          },
        },
        messages: {
          take: 10,
          orderBy: { sentAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                full_name: true,
                avatar_url: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get conversation messages with pagination
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    limit: number = 50,
    before?: Date,
  ): Promise<ResponseDto> {
    try {
      // Check if user is participant
      const isParticipant =
        await this.prisma.conversationParticipant.findUnique({
          where: {
            userId_conversationId: {
              userId,
              conversationId,
            },
          },
        });

      if (!isParticipant) {
        throw new ForbiddenException('Access denied to this conversation');
      }

      const messages = await this.prisma.message.findMany({
        where: {
          conversationId,
          ...(before && { sentAt: { lt: before } }),
        },
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
            },
          },
        },
      });

      // Return in chronological order
      messages.reverse();

      const response = {
        messages,
        hasMore: messages.length === limit,
        total: messages.length,
      };

      return ResponseDto.ok(response, 'Messages retrieved successfully');
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error('Failed to retrieve messages');
    }
  }
}
