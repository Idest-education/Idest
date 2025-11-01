import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';
import * as JWT from 'jsonwebtoken';
import { checkClassAccess } from './conversation.util';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) || [
      'http://localhost:3000',
    ],
    credentials: true,
  },
  namespace: '/conversation',
})
export class ConversationGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ConversationGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(
            new UnauthorizedException('Authentication token required'),
          );
        }

        const jwtSecret = process.env.JWT_SECRET as string;
        const decoded: any = JWT.verify(token, jwtSecret);

        if (!decoded?.sub) {
          return next(new Error('Invalid token'));
        }

        const user = await this.prisma.user.findUnique({
          where: { id: decoded.sub },
          select: { id: true, full_name: true, email: true, is_active: true },
        });

        if (!user || !user.is_active) {
          return next(new Error('User not found or inactive'));
        }

        socket.data.user = user;

        socket.join(user.id);

        this.logger.log(
          `Socket ${socket.id} authenticated for user ${user.id}`,
        );
        next();
      } catch (error) {
        this.logger.error(`Socket authentication failed: ${error.message}`);
        next(new Error('Authentication failed'));
      }
    });

    this.logger.log(
      'ConversationGateway initialized with authentication middleware',
    );
  }

  async emitConversationCreated(conversation: any) {
    if (conversation.participants && conversation.participants.length > 0) {
      const participantIds = conversation.participants.map(
        (p: any) => p.userId,
      );
      for (const userId of participantIds) {
        this.server.to(userId).emit('conversation-created', conversation);
      }
    }
  }

  async emitConversationDeleted(conversationId: string) {
    // Get conversation participants before deletion
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        participants: { select: { userId: true } },
      },
    });

    if (conversation && conversation.participants.length > 0) {
      const participantIds = conversation.participants.map((p) => p.userId);
      for (const userId of participantIds) {
        this.server.to(userId).emit('conversation-deleted', { conversationId });
      }
    }
  }

  async emitNewMessage(conversationId: string, message: any) {
    // Get conversation participants
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        participants: { select: { userId: true } },
        classId: true,
      },
    });

    if (conversation && conversation.participants.length > 0) {
      const participantIds = conversation.participants.map((p) => p.userId);

      // Emit to all participants
      for (const userId of participantIds) {
        this.server.to(userId).emit('message-new', message);
      }

      // Also emit to conversation room for clients that have joined the conversation
      this.server.to(conversationId).emit('message-new', message);
    }
  }

  async emitParticipantAdded(conversationId: string, participant: any) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        participants: { select: { userId: true } },
      },
    });

    if (conversation && conversation.participants.length > 0) {
      const participantIds = conversation.participants.map((p) => p.userId);

      // Emit to all participants including the new one
      for (const userId of participantIds) {
        this.server.to(userId).emit('participant-added', participant);
      }

      // Also emit to conversation room
      this.server.to(conversationId).emit('participant-added', participant);
    }
  }

  async emitParticipantRemoved(conversationId: string, removedUserId: string) {
    // Get remaining participants
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        participants: { select: { userId: true } },
      },
    });

    // Emit to removed user
    this.server
      .to(removedUserId)
      .emit('participant-removed', { userId: removedUserId });

    // Emit to remaining participants
    if (conversation && conversation.participants.length > 0) {
      const participantIds = conversation.participants.map((p) => p.userId);

      for (const userId of participantIds) {
        this.server
          .to(userId)
          .emit('participant-removed', { userId: removedUserId });
      }

      // Also emit to conversation room
      this.server
        .to(conversationId)
        .emit('participant-removed', { userId: removedUserId });
    }
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const user = client.data.user;
      if (!user) {
        client.emit('join-conversation-error', {
          message: 'Not authenticated',
        });
        return;
      }

      const conversation = await this.prisma.conversation.findUnique({
        where: { id: data.conversationId },
        select: {
          id: true,
          isDeleted: true,
          classId: true,
          participants: { select: { userId: true } },
        },
      });

      if (!conversation || conversation.isDeleted) {
        client.emit('join-conversation-error', {
          message: 'Conversation not available',
        });
        return;
      }

      // Check if user is a participant
      const isParticipant = conversation.participants.some(
        (p) => p.userId === user.id,
      );

      // For class conversations, also check class access
      let hasAccess = isParticipant;
      if (!hasAccess && conversation.classId) {
        hasAccess = await checkClassAccess(
          this.prisma,
          conversation.classId,
          user.id,
        );
      }

      if (!hasAccess) {
        client.emit('join-conversation-error', { message: 'Access denied' });
        return;
      }

      await client.join(data.conversationId);
      client.emit('join-conversation-success', {
        conversationId: data.conversationId,
      });

      this.logger.log(
        `Socket ${client.id} (user ${user.id}) joined conversation ${data.conversationId}`,
      );
    } catch (error) {
      this.logger.error(`join-conversation failed: ${error.message}`);
      client.emit('join-conversation-error', {
        message: 'Failed to join',
        details: error.message,
      });
    }
  }

  @SubscribeMessage('leave-conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    try {
      await client.leave(conversationId);
      client.emit('leave-conversation-success', { conversationId });
      this.logger.log(
        `Socket ${client.id} left conversation ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(`leave-conversation failed: ${error.message}`);
      client.emit('leave-conversation-error', { message: 'Failed to leave' });
    }
  }
}
