// import {
//   MessageBody,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   OnGatewayInit,
//   SubscribeMessage,
//   WebSocketGateway,
//   WebSocketServer,
//   ConnectedSocket,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import {
//   Logger,
//   UnauthorizedException,
//   NotFoundException,
//   ForbiddenException,
// } from '@nestjs/common';
// import { MeetService } from './meet.service';
// import { JoinRoomDto } from './dto/join-room.dto';
// import { ChatMessageDto, ChatMessageResponseDto } from './dto/chat-message.dto';
// import {
//   WebRTCOfferDto,
//   WebRTCAnswerDto,
//   ICECandidateDto,
// } from './dto/webrtc.dto';
// import {
//   UserJoinedDto,
//   UserLeftDto,
//   SessionParticipantsDto,
// } from './dto/room-events.dto';
// import {
//   GetMeetingMessagesDto,
//   MessageHistoryListDto,
//   MessageHistoryResponseDto,
// } from './dto/message-history.dto';
// import { ConnectedUser } from './utils/connected-users-manager';

// @WebSocketGateway(3002, {
//   cors: true,
//   namespace: '/meet',
// })
// export class MeetGateway
//   implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
// {
//   @WebSocketServer()
//   server: Server;

//   private readonly logger = new Logger(MeetGateway.name);

//   constructor(private readonly meetService: MeetService) {}

//   afterInit() {
//     this.logger.log('WebSocket Meet Gateway initialized on port 3002');
//   }

//   handleConnection(client: Socket) {
//     this.logger.log(`Client connected: ${client.id}`);
//   }

//   handleDisconnect(client: Socket) {
//     this.logger.log(`Client disconnected: ${client.id}`);

//     // Remove user from tracking and notify others
//     const disconnectedUser = this.meetService.removeConnectedUserBySocket(
//       client.id,
//     );
//     if (disconnectedUser) {
//       this.handleUserLeft(disconnectedUser);
//     }
//   }

//   /**
//    * Join Room - User joins a session
//    */
//   @SubscribeMessage('join-room')
//   async handleJoinRoom(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() data: JoinRoomDto,
//   ) {
//     try {
//       this.logger.log(`User attempting to join room: ${data.sessionId}`);

//       // Validate JWT token
//       const userPayload = await this.meetService.validateToken(data.token);

//       // Validate session exists and is active
//       await this.meetService.validateSession(data.sessionId);

//       // Validate user has access to this session
//       await this.meetService.validateUserSessionAccess(
//         userPayload.id,
//         data.sessionId,
//       );

//       // Get user details from database
//       const userDetails = await this.meetService.getUserDetails(userPayload.id);
//       if (!userDetails) {
//         throw new NotFoundException('User not found in database');
//       }

//       // Join the socket room
//       await client.join(data.sessionId);

//       // Create connected user object
//       const connectedUser: ConnectedUser = {
//         userId: userPayload.id,
//         socketId: client.id,
//         userFullName: userDetails.full_name,
//         userAvatar: userDetails.avatar_url,
//         role: userDetails.role,
//         sessionId: data.sessionId,
//         connectedAt: new Date(),
//       };

//       // Add to tracking
//       this.meetService.addConnectedUser(connectedUser);

//       // Notify other users in the room
//       const userJoinedData: UserJoinedDto = {
//         sessionId: data.sessionId,
//         userId: userPayload.id,
//         userFullName: userDetails.full_name,
//         userAvatar: userDetails.avatar_url,
//         role: userDetails.role,
//         socketId: client.id,
//       };

//       client.to(data.sessionId).emit('user-joined', userJoinedData);

//       // Send current participants list to the new user
//       const participants = await this.meetService.getSessionParticipants(
//         data.sessionId,
//       );
//       const participantsData: SessionParticipantsDto = {
//         sessionId: data.sessionId,
//         participants: participants.map((p) => ({
//           ...p,
//           socketId:
//             this.meetService.getUserSocketId(p.userId, data.sessionId) || '',
//         })),
//       };

//       client.emit('session-participants', participantsData);

//       // Load and send recent chat messages
//       try {
//         const recentMessages = await this.meetService.getMeetingMessages(
//           data.sessionId,
//           20,
//         );
//         if (recentMessages.length > 0) {
//           const messageHistory: MessageHistoryResponseDto[] =
//             recentMessages.map((msg) => ({
//               id: msg.id,
//               content: msg.content,
//               sentAt: msg.sentAt,
//               sender: {
//                 id: msg.sender.id,
//                 full_name: msg.sender.full_name,
//                 avatar_url: msg.sender.avatar_url || undefined,
//               },
//             }));

//           client.emit('message-history', {
//             messages: messageHistory,
//             hasMore: recentMessages.length === 20,
//             total: recentMessages.length,
//           });
//         }
//       } catch (error) {
//         this.logger.warn(
//           `Failed to load message history for session ${data.sessionId}: ${error.message}`,
//         );
//       }

//       // Confirm successful join
//       client.emit('join-room-success', {
//         sessionId: data.sessionId,
//         userId: userPayload.id,
//         message: 'Successfully joined the session',
//       });

//       this.logger.log(
//         `User ${userPayload.id} successfully joined session ${data.sessionId}`,
//       );
//     } catch (error) {
//       this.logger.error(`Failed to join room: ${error.message}`);

//       let errorMessage = 'Failed to join session';
//       if (error instanceof UnauthorizedException) {
//         errorMessage = 'Authentication failed';
//       } else if (error instanceof NotFoundException) {
//         errorMessage = 'Session not found';
//       } else if (error instanceof ForbiddenException) {
//         errorMessage = 'Access denied';
//       }

//       client.emit('join-room-error', {
//         message: errorMessage,
//         details: error.message,
//       });
//     }
//   }

//   /**
//    * Leave Room - User leaves a session
//    */
//   @SubscribeMessage('leave-room')
//   async handleLeaveRoom(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() sessionId: string,
//   ) {
//     try {
//       // Validate user is in this session
//       const user = this.meetService.getUserBySocket(client.id);
//       if (!user || user.sessionId !== sessionId) {
//         client.emit('leave-room-error', { message: 'Not in this session' });
//         return;
//       }

//       // Leave the socket room
//       await client.leave(sessionId);

//       // Remove from tracking
//       this.meetService.removeConnectedUserBySocket(client.id);

//       // Notify other users
//       this.handleUserLeft(user);

//       client.emit('leave-room-success', { sessionId });
//       this.logger.log(`User ${user.userId} left session ${sessionId}`);
//     } catch (error) {
//       this.logger.error(`Failed to leave room: ${error.message}`);
//       client.emit('leave-room-error', { message: 'Failed to leave session' });
//     }
//   }

//   /**
//    * Chat Message - Send text message to session
//    */
//   @SubscribeMessage('chat-message')
//   async handleChatMessage(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() data: ChatMessageDto,
//   ) {
//     try {
//       // Validate user is in this session
//       const user = this.meetService.getUserBySocket(client.id);
//       if (!user || user.sessionId !== data.sessionId) {
//         client.emit('chat-message-error', { message: 'Not in this session' });
//         return;
//       }

//       // Save message to database
//       const savedMessage = await this.meetService.saveMeetingMessage(
//         user.userId,
//         data.sessionId,
//         data.message,
//       );

//       const chatResponse: ChatMessageResponseDto = {
//         sessionId: data.sessionId,
//         message: data.message,
//         userId: user.userId,
//         userFullName: user.userFullName,
//         userAvatar: user.userAvatar,
//         timestamp: savedMessage?.sentAt || new Date(),
//       };

//       // Broadcast to all users in the session (including sender)
//       this.server.to(data.sessionId).emit('chat-message', chatResponse);

//       this.logger.log(
//         `Chat message from ${user.userId} in session ${data.sessionId} ${savedMessage ? 'saved to DB' : 'broadcast only'}`,
//       );
//     } catch (error) {
//       this.logger.error(`Failed to send chat message: ${error.message}`);
//       client.emit('chat-message-error', { message: 'Failed to send message' });
//     }
//   }

//   /**
//    * WebRTC Offer - Send WebRTC offer to specific peer
//    */
//   @SubscribeMessage('webrtc-offer')
//   async handleWebRTCOffer(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() data: WebRTCOfferDto,
//   ) {
//     try {
//       // Validate user is in this session
//       const sender = this.meetService.getUserBySocket(client.id);
//       if (!sender || sender.sessionId !== data.sessionId) {
//         client.emit('webrtc-offer-error', { message: 'Not in this session' });
//         return;
//       }

//       const targetSocketId = this.meetService.getUserSocketId(
//         data.targetUserId,
//         data.sessionId,
//       );
//       if (!targetSocketId) {
//         client.emit('webrtc-offer-error', { message: 'Target user not found' });
//         return;
//       }

//       // Send offer to target user
//       this.server.to(targetSocketId).emit('webrtc-offer', {
//         sessionId: data.sessionId,
//         fromUserId: sender.userId,
//         fromUserName: sender.userFullName,
//         offer: data.offer,
//       });

//       this.logger.log(
//         `WebRTC offer from ${sender.userId} to ${data.targetUserId} in session ${data.sessionId}`,
//       );
//     } catch (error) {
//       this.logger.error(`Failed to send WebRTC offer: ${error.message}`);
//       client.emit('webrtc-offer-error', { message: 'Failed to send offer' });
//     }
//   }

//   /**
//    * WebRTC Answer - Send WebRTC answer to specific peer
//    */
//   @SubscribeMessage('webrtc-answer')
//   async handleWebRTCAnswer(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() data: WebRTCAnswerDto,
//   ) {
//     try {
//       // Validate user is in this session
//       const sender = this.meetService.getUserBySocket(client.id);
//       if (!sender || sender.sessionId !== data.sessionId) {
//         client.emit('webrtc-answer-error', { message: 'Not in this session' });
//         return;
//       }

//       const targetSocketId = this.meetService.getUserSocketId(
//         data.targetUserId,
//         data.sessionId,
//       );
//       if (!targetSocketId) {
//         client.emit('webrtc-answer-error', {
//           message: 'Target user not found',
//         });
//         return;
//       }

//       // Send answer to target user
//       this.server.to(targetSocketId).emit('webrtc-answer', {
//         sessionId: data.sessionId,
//         fromUserId: sender.userId,
//         fromUserName: sender.userFullName,
//         answer: data.answer,
//       });

//       this.logger.log(
//         `WebRTC answer from ${sender.userId} to ${data.targetUserId} in session ${data.sessionId}`,
//       );
//     } catch (error) {
//       this.logger.error(`Failed to send WebRTC answer: ${error.message}`);
//       client.emit('webrtc-answer-error', { message: 'Failed to send answer' });
//     }
//   }

//   /**
//    * ICE Candidate - Send ICE candidate to specific peer
//    */
//   @SubscribeMessage('ice-candidate')
//   async handleICECandidate(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() data: ICECandidateDto,
//   ) {
//     try {
//       // Validate user is in this session
//       const sender = this.meetService.getUserBySocket(client.id);
//       if (!sender || sender.sessionId !== data.sessionId) {
//         client.emit('ice-candidate-error', { message: 'Not in this session' });
//         return;
//       }

//       const targetSocketId = this.meetService.getUserSocketId(
//         data.targetUserId,
//         data.sessionId,
//       );
//       if (!targetSocketId) {
//         client.emit('ice-candidate-error', {
//           message: 'Target user not found',
//         });
//         return;
//       }

//       // Send ICE candidate to target user
//       this.server.to(targetSocketId).emit('ice-candidate', {
//         sessionId: data.sessionId,
//         fromUserId: sender.userId,
//         candidate: data.candidate,
//       });

//       this.logger.log(
//         `ICE candidate from ${sender.userId} to ${data.targetUserId} in session ${data.sessionId}`,
//       );
//     } catch (error) {
//       this.logger.error(`Failed to send ICE candidate: ${error.message}`);
//       client.emit('ice-candidate-error', {
//         message: 'Failed to send ICE candidate',
//       });
//     }
//   }

//   /**
//    * Get Session Participants - Get list of all participants in session
//    */
//   @SubscribeMessage('get-session-participants')
//   async handleGetSessionParticipants(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() sessionId: string,
//   ) {
//     try {
//       // Validate user is in this session
//       const user = this.meetService.getUserBySocket(client.id);
//       if (!user || user.sessionId !== sessionId) {
//         client.emit('session-participants-error', {
//           message: 'Not in this session',
//         });
//         return;
//       }

//       const participants =
//         await this.meetService.getSessionParticipants(sessionId);
//       const participantsData: SessionParticipantsDto = {
//         sessionId,
//         participants: participants.map((p) => ({
//           ...p,
//           socketId: this.meetService.getUserSocketId(p.userId, sessionId) || '',
//         })),
//       };

//       client.emit('session-participants', participantsData);
//     } catch (error) {
//       this.logger.error(`Failed to get session participants: ${error.message}`);
//       client.emit('session-participants-error', {
//         message: 'Failed to get participants',
//       });
//     }
//   }

//   /**
//    * Get Message History - Load more chat messages from database
//    */
//   @SubscribeMessage('get-message-history')
//   async handleGetMessageHistory(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() data: GetMeetingMessagesDto,
//   ) {
//     try {
//       // Validate user is in this session
//       const user = this.meetService.getUserBySocket(client.id);
//       if (!user || user.sessionId !== data.sessionId) {
//         client.emit('message-history-error', {
//           message: 'Not in this session',
//         });
//         return;
//       }

//       const beforeDate = data.before ? new Date(data.before) : undefined;
//       const messages = await this.meetService.getMeetingMessages(
//         data.sessionId,
//         data.limit || 50,
//         beforeDate,
//       );

//       const messageHistory: MessageHistoryResponseDto[] = messages.map(
//         (msg) => ({
//           id: msg.id,
//           content: msg.content,
//           sentAt: msg.sentAt,
//           sender: {
//             id: msg.sender.id,
//             full_name: msg.sender.full_name,
//             avatar_url: msg.sender.avatar_url || undefined,
//           },
//         }),
//       );

//       const response: MessageHistoryListDto = {
//         messages: messageHistory,
//         hasMore: messages.length === (data.limit || 50),
//         total: messages.length,
//       };

//       client.emit('message-history', response);

//       this.logger.log(
//         `Loaded ${messages.length} messages for session ${data.sessionId}`,
//       );
//     } catch (error) {
//       this.logger.error(`Failed to get message history: ${error.message}`);
//       client.emit('message-history-error', {
//         message: 'Failed to load message history',
//       });
//     }
//   }

//   /**
//    * Helper method to handle user left event
//    */
//   private handleUserLeft(user: ConnectedUser) {
//     const userLeftData: UserLeftDto = {
//       sessionId: user.sessionId,
//       userId: user.userId,
//       socketId: user.socketId,
//     };

//     // Notify other users in the session
//     this.server.to(user.sessionId).emit('user-left', userLeftData);

//     this.logger.log(`User ${user.userId} left session ${user.sessionId}`);
//   }
// }
