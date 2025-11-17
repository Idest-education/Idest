import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { MeetService } from './meet.service';
import { JoinRoomDto } from './dto/join-room.dto';
import { ChatMessageDto, ChatMessageResponseDto } from './dto/chat-message.dto';
import {
  UserJoinedDto,
  UserLeftDto,
  SessionParticipantsDto,
  ScreenShareResponseDto,
  MediaToggleResponseDto,
} from './dto/room-events.dto';
import {
  GetMeetingMessagesDto,
  MessageHistoryListDto,
  MessageHistoryResponseDto,
} from './dto/message-history.dto';
import {
  StartScreenShareDto,
  StopScreenShareDto,
  ToggleMediaDto,
} from './dto/media-controls.dto';
import { ConnectedUser } from './utils/connected-users-manager';
import { LiveKitCredentials } from './meet.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) || [
      'http://localhost:3000',
    ],
    credentials: true,
  },
  namespace: '/meet',
})
export class MeetGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MeetGateway.name);

  constructor(private readonly meetService: MeetService) {}

  afterInit() {
    this.logger.log('WebSocket Meet Gateway initialized on shared HTTP port');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove user from tracking and notify others
    const disconnectedUser = this.meetService.removeConnectedUserBySocket(
      client.id,
    );
    if (disconnectedUser) {
      this.handleUserLeft(disconnectedUser);
    }
  }

  /**
   * Join Room - User joins a session
   */
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    try {
      this.logger.log(`User attempting to join room: ${data.sessionId}`);

      // Validate JWT token
      const userPayload = await this.meetService.validateToken(data.token);

      // Validate that the token has a user ID (sub field)
      if (!userPayload.sub) {
        throw new UnauthorizedException('Invalid token: missing user ID');
      }

      // Store the user ID after validation
      const userId = userPayload.sub;

      // Validate session exists and is active
      await this.meetService.validateSession(data.sessionId);

      // Validate user has access to this session
      await this.meetService.validateUserSessionAccess(userId, data.sessionId);

      // Get user details from database
      const userDetails = await this.meetService.getUserDetails(userId);
      if (!userDetails) {
        throw new NotFoundException('User not found in database');
      }

      // Join the socket room
      await client.join(data.sessionId);

      // Create connected user object
      const connectedUser: ConnectedUser = {
        userId: userId,
        socketId: client.id,
        userFullName: userDetails.full_name,
        userAvatar: userDetails.avatar_url,
        role: userDetails.role,
        sessionId: data.sessionId,
        connectedAt: new Date(),
      };

      // Add to tracking
      this.meetService.addConnectedUser(connectedUser);

      // Notify other users in the room
      const userJoinedData: UserJoinedDto = {
        sessionId: data.sessionId,
        userId: userId,
        userFullName: userDetails.full_name,
        userAvatar: userDetails.avatar_url,
        role: userDetails.role,
        socketId: client.id,
      };

      client.to(data.sessionId).emit('user-joined', userJoinedData);

      // Send current participants list to the new user
      const participants = await this.meetService.getSessionParticipants(
        data.sessionId,
      );
      const participantsData: SessionParticipantsDto = {
        sessionId: data.sessionId,
        participants: participants.map((p) => ({
          ...p,
          socketId:
            this.meetService.getUserSocketId(p.userId, data.sessionId) || '',
        })),
      };

      client.emit('session-participants', participantsData);

      // Prepare LiveKit credentials for this participant
      let liveKitCredentials: LiveKitCredentials | null = null;
      try {
        liveKitCredentials = await this.meetService.prepareLiveKitCredentials(
          userId,
          data.sessionId,
          userDetails,
        );
      } catch (error) {
        this.logger.error(
          `Failed to prepare LiveKit credentials for session ${data.sessionId}: ${error instanceof Error ? error.message : error}`,
        );
        throw new Error('LiveKit initialization failed');
      }

      // Load and send recent chat messages
      try {
        const recentMessages = await this.meetService.getMeetingMessages(
          data.sessionId,
          20,
        );
        if (recentMessages.length > 0) {
          const messageHistory: MessageHistoryResponseDto[] =
            recentMessages.map((msg) => ({
              id: msg.id,
              content: msg.content,
              sentAt: msg.sentAt,
              sender: {
                id: msg.sender.id,
                full_name: msg.sender.full_name,
                avatar_url: msg.sender.avatar_url || undefined,
              },
            }));

          client.emit('message-history', {
            messages: messageHistory,
            hasMore: recentMessages.length === 20,
            total: recentMessages.length,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to load message history for session ${data.sessionId}: ${error.message}`,
        );
      }

      // Confirm successful join
      client.emit('join-room-success', {
        sessionId: data.sessionId,
        userId: userId,
        message: 'Successfully joined the session',
        livekit: liveKitCredentials,
      });

      this.logger.log(
        `User ${userId} successfully joined session ${data.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to join room: ${error.message}`);

      let errorMessage = 'Failed to join session';
      if (error instanceof UnauthorizedException) {
        errorMessage = 'Authentication failed';
      } else if (error instanceof NotFoundException) {
        errorMessage = 'Session not found';
      } else if (error instanceof ForbiddenException) {
        errorMessage = 'Access denied';
      }

      client.emit('join-room-error', {
        message: errorMessage,
        details: error.message,
      });
    }
  }

  /**
   * Leave Room - User leaves a session
   */
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() sessionId: string,
  ) {
    try {
      // Validate user is in this session
      const user = this.meetService.getUserBySocket(client.id);
      if (!user || user.sessionId !== sessionId) {
        client.emit('leave-room-error', { message: 'Not in this session' });
        return;
      }

      // Leave the socket room
      await client.leave(sessionId);

      // Remove from tracking
      this.meetService.removeConnectedUserBySocket(client.id);

      // Notify other users
      this.handleUserLeft(user);

      client.emit('leave-room-success', { sessionId });
      this.logger.log(`User ${user.userId} left session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to leave room: ${error.message}`);
      client.emit('leave-room-error', { message: 'Failed to leave session' });
    }
  }

  /**
   * Chat Message - Send text message to session
   */
  @SubscribeMessage('chat-message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatMessageDto,
  ) {
    try {
      // Validate user is in this session
      const user = this.meetService.getUserBySocket(client.id);
      if (!user || user.sessionId !== data.sessionId) {
        client.emit('chat-message-error', { message: 'Not in this session' });
        return;
      }

      // Save message to database
      const savedMessage = await this.meetService.saveMeetingMessage(
        user.userId,
        data.sessionId,
        data.message,
      );

      const chatResponse: ChatMessageResponseDto = {
        sessionId: data.sessionId,
        message: data.message,
        userId: user.userId,
        userFullName: user.userFullName,
        userAvatar: user.userAvatar,
        timestamp: savedMessage?.sentAt || new Date(),
      };

      // Broadcast to all users in the session (including sender)
      this.server.to(data.sessionId).emit('chat-message', chatResponse);

      // Relay through LiveKit data channel so clients connected via SFU receive chat
      try {
        await this.meetService.broadcastLiveKitEvent(
          data.sessionId,
          'chat-message',
          chatResponse,
        );
      } catch (error) {
        this.logger.error(
          `Failed to relay chat via LiveKit for session ${data.sessionId}: ${error instanceof Error ? error.message : error}`,
        );
      }

      this.logger.log(
        `Chat message from ${user.userId} in session ${data.sessionId} ${savedMessage ? 'saved to DB' : 'broadcast only'}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send chat message: ${error.message}`);
      client.emit('chat-message-error', { message: 'Failed to send message' });
    }
  }


  /**
   * Get Session Participants - Get list of all participants in session
   */
  @SubscribeMessage('get-session-participants')
  async handleGetSessionParticipants(
    @ConnectedSocket() client: Socket,
    @MessageBody() sessionId: string,
  ) {
    try {
      // Validate user is in this session
      const user = this.meetService.getUserBySocket(client.id);
      if (!user || user.sessionId !== sessionId) {
        client.emit('session-participants-error', {
          message: 'Not in this session',
        });
        return;
      }

      const participants =
        await this.meetService.getSessionParticipants(sessionId);
      const participantsData: SessionParticipantsDto = {
        sessionId,
        participants: participants.map((p) => ({
          ...p,
          socketId: this.meetService.getUserSocketId(p.userId, sessionId) || '',
        })),
      };

      client.emit('session-participants', participantsData);
    } catch (error) {
      this.logger.error(`Failed to get session participants: ${error.message}`);
      client.emit('session-participants-error', {
        message: 'Failed to get participants',
      });
    }
  }

  /**
   * Get Message History - Load more chat messages from database
   */
  @SubscribeMessage('get-message-history')
  async handleGetMessageHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GetMeetingMessagesDto,
  ) {
    try {
      // Validate user is in this session
      const user = this.meetService.getUserBySocket(client.id);
      if (!user || user.sessionId !== data.sessionId) {
        client.emit('message-history-error', {
          message: 'Not in this session',
        });
        return;
      }

      const beforeDate = data.before ? new Date(data.before) : undefined;
      const messages = await this.meetService.getMeetingMessages(
        data.sessionId,
        data.limit || 50,
        beforeDate,
      );

      const messageHistory: MessageHistoryResponseDto[] = messages.map(
        (msg) => ({
          id: msg.id,
          content: msg.content,
          sentAt: msg.sentAt,
          sender: {
            id: msg.sender.id,
            full_name: msg.sender.full_name,
            avatar_url: msg.sender.avatar_url || undefined,
          },
        }),
      );

      const response: MessageHistoryListDto = {
        messages: messageHistory,
        hasMore: messages.length === (data.limit || 50),
        total: messages.length,
      };

      client.emit('message-history', response);

      this.logger.log(
        `Loaded ${messages.length} messages for session ${data.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to get message history: ${error.message}`);
      client.emit('message-history-error', {
        message: 'Failed to load message history',
      });
    }
  }

  /**
   * Start Screen Share - Notify participants that user started sharing screen
   */
  @SubscribeMessage('start-screen-share')
  async handleStartScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartScreenShareDto,
  ) {
    try {
      // Validate user is in this session
      const user = this.meetService.getUserBySocket(client.id);
      if (!user || user.sessionId !== data.sessionId) {
        client.emit('screen-share-error', { message: 'Not in this session' });
        return;
      }

      const screenShareResponse: ScreenShareResponseDto = {
        sessionId: data.sessionId,
        userId: user.userId,
        userFullName: user.userFullName,
        userAvatar: user.userAvatar,
        isSharing: true,
      };

      // Broadcast to all users in the session (including sender)
      this.server
        .to(data.sessionId)
        .emit('screen-share-started', screenShareResponse);

      try {
        await this.meetService.broadcastLiveKitEvent(
          data.sessionId,
          'screen-share-started',
          screenShareResponse,
        );
      } catch (error) {
        this.logger.error(
          `Failed to relay screen-share-started via LiveKit for session ${data.sessionId}: ${error instanceof Error ? error.message : error}`,
        );
      }

      this.logger.log(
        `User ${user.userId} started screen sharing in session ${data.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to start screen share: ${error.message}`);
      client.emit('screen-share-error', {
        message: 'Failed to start screen share',
      });
    }
  }

  /**
   * Stop Screen Share - Notify participants that user stopped sharing screen
   */
  @SubscribeMessage('stop-screen-share')
  async handleStopScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StopScreenShareDto,
  ) {
    try {
      // Validate user is in this session
      const user = this.meetService.getUserBySocket(client.id);
      if (!user || user.sessionId !== data.sessionId) {
        client.emit('screen-share-error', { message: 'Not in this session' });
        return;
      }

      const screenShareResponse: ScreenShareResponseDto = {
        sessionId: data.sessionId,
        userId: user.userId,
        userFullName: user.userFullName,
        userAvatar: user.userAvatar,
        isSharing: false,
      };

      // Broadcast to all users in the session (including sender)
      this.server
        .to(data.sessionId)
        .emit('screen-share-stopped', screenShareResponse);

      try {
        await this.meetService.broadcastLiveKitEvent(
          data.sessionId,
          'screen-share-stopped',
          screenShareResponse,
        );
      } catch (error) {
        this.logger.error(
          `Failed to relay screen-share-stopped via LiveKit for session ${data.sessionId}: ${error instanceof Error ? error.message : error}`,
        );
      }

      this.logger.log(
        `User ${user.userId} stopped screen sharing in session ${data.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to stop screen share: ${error.message}`);
      client.emit('screen-share-error', {
        message: 'Failed to stop screen share',
      });
    }
  }

  /**
   * Toggle Media - Toggle audio/video media state
   */
  @SubscribeMessage('toggle-media')
  async handleToggleMedia(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ToggleMediaDto,
  ) {
    try {
      // Validate user is in this session
      const user = this.meetService.getUserBySocket(client.id);
      if (!user || user.sessionId !== data.sessionId) {
        client.emit('media-toggle-error', { message: 'Not in this session' });
        return;
      }

      const mediaToggleResponse: MediaToggleResponseDto = {
        sessionId: data.sessionId,
        userId: user.userId,
        userFullName: user.userFullName,
        userAvatar: user.userAvatar,
        type: data.type,
        isEnabled: data.isEnabled,
      };

      // Broadcast to all users in the session (including sender)
      this.server.to(data.sessionId).emit('media-toggled', mediaToggleResponse);

      this.logger.log(
        `User ${user.userId} toggled ${data.type} to ${data.isEnabled ? 'enabled' : 'disabled'} in session ${data.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to toggle media: ${error.message}`);
      client.emit('media-toggle-error', { message: 'Failed to toggle media' });
    }
  }

  /**
   * Helper method to handle user left event
   */
  private handleUserLeft(user: ConnectedUser) {
    const userLeftData: UserLeftDto = {
      sessionId: user.sessionId,
      userId: user.userId,
      socketId: user.socketId,
    };

    // Notify other users in the session
    this.server.to(user.sessionId).emit('user-left', userLeftData);

    this.logger.log(`User ${user.userId} left session ${user.sessionId}`);
  }

  // ============================== DEPRECATED ==============================
  // DEPRECATED: Legacy manual WebRTC signaling handlers retained for reference.
  /*
  @SubscribeMessage('webrtc-offer')
  async handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebRTCOfferDto,
  ) {
    try {
      const sender = this.meetService.getUserBySocket(client.id);
      if (!sender || sender.sessionId !== data.sessionId) {
        client.emit('webrtc-offer-error', { message: 'Not in this session' });
        return;
      }

      const targetSocketId = this.meetService.getUserSocketId(
        data.targetUserId,
        data.sessionId,
      );
      if (!targetSocketId) {
        client.emit('webrtc-offer-error', { message: 'Target user not found' });
        return;
      }

      this.server.to(targetSocketId).emit('webrtc-offer', {
        sessionId: data.sessionId,
        fromUserId: sender.userId,
        fromUserName: sender.userFullName,
        offer: data.offer,
      });
    } catch (error) {
      this.logger.error(`Failed to send WebRTC offer: ${error.message}`);
      client.emit('webrtc-offer-error', { message: 'Failed to send offer' });
    }
  }

  @SubscribeMessage('webrtc-answer')
  async handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebRTCAnswerDto,
  ) {
    try {
      const sender = this.meetService.getUserBySocket(client.id);
      if (!sender || sender.sessionId !== data.sessionId) {
        client.emit('webrtc-answer-error', { message: 'Not in this session' });
        return;
      }

      const targetSocketId = this.meetService.getUserSocketId(
        data.targetUserId,
        data.sessionId,
      );
      if (!targetSocketId) {
        client.emit('webrtc-answer-error', {
          message: 'Target user not found',
        });
        return;
      }

      this.server.to(targetSocketId).emit('webrtc-answer', {
        sessionId: data.sessionId,
        fromUserId: sender.userId,
        fromUserName: sender.userFullName,
        answer: data.answer,
      });
    } catch (error) {
      this.logger.error(`Failed to send WebRTC answer: ${error.message}`);
      client.emit('webrtc-answer-error', { message: 'Failed to send answer' });
    }
  }

  @SubscribeMessage('ice-candidate')
  async handleICECandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ICECandidateDto,
  ) {
    try {
      const sender = this.meetService.getUserBySocket(client.id);
      if (!sender || sender.sessionId !== data.sessionId) {
        client.emit('ice-candidate-error', { message: 'Not in this session' });
        return;
      }

      const targetSocketId = this.meetService.getUserSocketId(
        data.targetUserId,
        data.sessionId,
      );
      if (!targetSocketId) {
        client.emit('ice-candidate-error', {
          message: 'Target user not found',
        });
        return;
      }

      this.server.to(targetSocketId).emit('ice-candidate', {
        sessionId: data.sessionId,
        fromUserId: sender.userId,
        candidate: data.candidate,
      });
    } catch (error) {
      this.logger.error(`Failed to send ICE candidate: ${error.message}`);
      client.emit('ice-candidate-error', {
        message: 'Failed to send ICE candidate',
      });
    }
  }
  */
}
