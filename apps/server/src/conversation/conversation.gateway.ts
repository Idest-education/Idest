import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';
import * as JWT from 'jsonwebtoken';

@WebSocketGateway(3003, {
  cors: true,
  namespace: '/conversation',
})
export class ConversationGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ConversationGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  emitConversationCreated(conversation: any) {
    this.server.emit('conversation-created', conversation);
  }

  emitConversationDeleted(conversationId: string) {
    this.server.emit('conversation-deleted', { conversationId });
  }

  emitNewMessage(conversationId: string, message: any) {
    this.server.to(conversationId).emit('message-new', message);
  }

  emitParticipantAdded(conversationId: string, participant: any) {
    this.server.to(conversationId).emit('participant-added', participant);
  }

  emitParticipantRemoved(conversationId: string, userId: string) {
    this.server.to(conversationId).emit('participant-removed', { userId });
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { token: string; conversationId: string },
  ) {
    try {
      const jwtSecret = process.env.JWT_SECRET as string;
      const decoded: any = JWT.verify(data.token, jwtSecret);
      if (!decoded?.sub) throw new UnauthorizedException('Invalid token');

      // Validate user is a participant and conversation is not deleted
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: data.conversationId },
        select: {
          id: true,
          isDeleted: true,
          participants: { select: { userId: true } },
        },
      });
      if (!conversation || conversation.isDeleted) {
        client.emit('join-conversation-error', {
          message: 'Conversation not available',
        });
        return;
      }
      const isParticipant = conversation.participants.some(
        (p) => p.userId === decoded.sub,
      );
      if (!isParticipant) {
        client.emit('join-conversation-error', { message: 'Access denied' });
        return;
      }

      await client.join(data.conversationId);
      client.emit('join-conversation-success', {
        conversationId: data.conversationId,
      });
      this.logger.log(
        `Socket ${client.id} joined conversation ${data.conversationId}`,
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
