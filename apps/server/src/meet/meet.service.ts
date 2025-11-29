import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import {
  ConnectedUsersManager,
  ConnectedUser,
} from './utils/connected-users-manager';
import {
  LiveKitService,
  type LiveKitDataMessageOptions,
} from './utils/livekit.service';
import { verifyTokenAsync } from 'src/common/guard/auth.guard';
import { JwtPayload } from 'jsonwebtoken';

export interface LiveKitCredentials {
  url: string;
  roomName: string;
  accessToken: string;
}

@Injectable()
export class MeetService {
  private readonly logger = new Logger(MeetService.name);
  // Track active screen sharer per session: sessionId -> userId
  private activeScreenSharers = new Map<string, string>();
  // Track active canvas per session: sessionId -> userId
  private activeCanvasSessions = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly connectedUsersManager: ConnectedUsersManager,
    private readonly liveKitService: LiveKitService,
  ) {}
  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      return await verifyTokenAsync(token, process.env.JWT_SECRET!);
    } catch (error) {
      throw new UnauthorizedException('Invalid token, please login again');
    }
  }

  /**
   * Validate if a session exists and is active
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          class: true,
        },
      });

      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      if (session.end_time && session.end_time < new Date()) {
        throw new ForbiddenException(`Session ${sessionId} has already ended`);
      }

      return true;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`Failed to validate session: ${error.message}`);
    }
  }

  /**
   * Check if user is authorized to join a session
   */
  async validateUserSessionAccess(
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          class: {
            include: {
              members: true,
              teachers: true,
              creator: true,
            },
          },
          host: true,
        },
      });

      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      if (session.host_id === userId) {
        return true;
      }

      if (session.class.created_by === userId) {
        return true;
      }

      const isTeacher = session.class.teachers.some(
        (teacher) => teacher.teacher_id === userId,
      );
      if (isTeacher) {
        return true;
      }

      const isMember = session.class.members.some(
        (member) => member.student_id === userId && member.status === 'active',
      );
      if (isMember) {
        return true;
      }

      throw new ForbiddenException(
        `User ${userId} is not authorized to access session ${sessionId}`,
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(
        `Failed to validate user session access: ${error.message}`,
      );
    }
  }

  /**
   * Get user details from database (delegated to UserService)
   */
  async getUserDetails(userId: string) {
    return this.userService.getUserDetails(userId);
  }

  async prepareLiveKitCredentials(
    userId: string,
    sessionId: string,
    userDetails: {
      full_name: string;
      role: string;
      email: string;
      avatar_url?: string;
    },
  ): Promise<LiveKitCredentials> {
    const { roomName } = await this.liveKitService.ensureSessionRoom({
      sessionId,
      metadata: {
        sessionId,
      },
    });

    const accessToken = await this.liveKitService.generateToken({
      roomName,
      identity: userId,
      name: userDetails.full_name,
      metadata: {
        sessionId,
        userId,
        role: userDetails.role,
        email: userDetails.email,
        avatarUrl: userDetails.avatar_url,
      },
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      url: this.liveKitService.url,
      roomName,
      accessToken,
    };
  }

  async broadcastLiveKitEvent(
    sessionId: string,
    type: string,
    payload: unknown,
    options?: LiveKitDataMessageOptions,
  ): Promise<void> {
    await this.liveKitService.sendSessionDataMessage(
      sessionId,
      {
        type,
        payload,
        sessionId,
        timestamp: new Date().toISOString(),
      },
      options,
    );
  }

  /**
   * Get all authorized participants for a session
   */
  async getSessionParticipants(sessionId: string): Promise<
    Array<{
      userId: string;
      userFullName: string;
      userAvatar?: string;
      role: string;
      isOnline: boolean;
    }>
  > {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          class: {
            include: {
              members: {
                include: {
                  student: {
                    select: {
                      id: true,
                      full_name: true,
                      avatar_url: true,
                      role: true,
                    },
                  },
                },
              },
              teachers: {
                include: {
                  teacher: {
                    select: {
                      id: true,
                      full_name: true,
                      avatar_url: true,
                      role: true,
                    },
                  },
                },
              },
              creator: {
                select: {
                  id: true,
                  full_name: true,
                  avatar_url: true,
                  role: true,
                },
              },
            },
          },
          host: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
              role: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      const participants = new Map<string, any>();

      if (session.host) {
        participants.set(session.host.id, {
          userId: session.host.id,
          userFullName: session.host.full_name,
          userAvatar: session.host.avatar_url,
          role: session.host.role,
          isOnline: this.connectedUsersManager.isUserConnected(
            session.host.id,
            sessionId,
          ),
        });
      }

      if (session.class.creator) {
        participants.set(session.class.creator.id, {
          userId: session.class.creator.id,
          userFullName: session.class.creator.full_name,
          userAvatar: session.class.creator.avatar_url,
          role: session.class.creator.role,
          isOnline: this.connectedUsersManager.isUserConnected(
            session.class.creator.id,
            sessionId,
          ),
        });
      }

      // Add teachers
      session.class.teachers.forEach((classTeacher) => {
        if (classTeacher.teacher) {
          participants.set(classTeacher.teacher.id, {
            userId: classTeacher.teacher.id,
            userFullName: classTeacher.teacher.full_name,
            userAvatar: classTeacher.teacher.avatar_url,
            role: classTeacher.teacher.role,
            isOnline: this.connectedUsersManager.isUserConnected(
              classTeacher.teacher.id,
              sessionId,
            ),
          });
        }
      });

      session.class.members
        .filter((member) => member.status === 'active')
        .forEach((member) => {
          if (member.student) {
            participants.set(member.student.id, {
              userId: member.student.id,
              userFullName: member.student.full_name,
              userAvatar: member.student.avatar_url,
              role: member.student.role,
              isOnline: this.connectedUsersManager.isUserConnected(
                member.student.id,
                sessionId,
              ),
            });
          }
        });

      return Array.from(participants.values());
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to get session participants: ${error.message}`);
    }
  }

  /**
   * Add user to connected users tracking
   */
  addConnectedUser(user: ConnectedUser): void {
    this.connectedUsersManager.addUser(user);
  }

  /**
   * Remove user from connected users tracking by socket ID
   */
  removeConnectedUserBySocket(socketId: string): ConnectedUser | null {
    return this.connectedUsersManager.removeUserBySocket(socketId);
  }

  /**
   * Get connected users for a session
   */
  getConnectedUsers(sessionId: string): ConnectedUser[] {
    return this.connectedUsersManager.getSessionUsers(sessionId);
  }

  /**
   * Get user by socket ID
   */
  getUserBySocket(socketId: string): ConnectedUser | null {
    return this.connectedUsersManager.getUserBySocket(socketId);
  }

  /**
   * Get socket ID for a user in a session
   */
  getUserSocketId(userId: string, sessionId: string): string | null {
    return this.connectedUsersManager.getUserSocketId(userId, sessionId);
  }

  /**
   * Get connected user by user ID and session ID
   */
  getUser(userId: string, sessionId: string): ConnectedUser | null {
    return this.connectedUsersManager.getUser(userId, sessionId);
  }

  /**
   * Check if someone is currently sharing screen in a session
   */
  isScreenSharingActive(sessionId: string): boolean {
    return this.activeScreenSharers.has(sessionId);
  }

  /**
   * Get the user ID of the active screen sharer in a session
   */
  getActiveScreenSharer(sessionId: string): string | null {
    return this.activeScreenSharers.get(sessionId) || null;
  }

  /**
   * Set active screen sharer for a session
   */
  setActiveScreenSharer(sessionId: string, userId: string): void {
    this.activeScreenSharers.set(sessionId, userId);
  }

  /**
   * Clear active screen sharer for a session
   */
  clearActiveScreenSharer(sessionId: string): void {
    this.activeScreenSharers.delete(sessionId);
  }

  /**
   * Clear screen share state when user disconnects or leaves
   */
  clearScreenShareOnUserLeave(userId: string, sessionId: string): void {
    const activeSharer = this.activeScreenSharers.get(sessionId);
    if (activeSharer === userId) {
      this.activeScreenSharers.delete(sessionId);
    }
  }

  /**
   * Canvas State Management Methods
   */

  /**
   * Check if canvas is currently active in a session
   */
  isCanvasActive(sessionId: string): boolean {
    return this.activeCanvasSessions.has(sessionId);
  }

  /**
   * Get the user ID of the active canvas user in a session
   */
  getActiveCanvasUser(sessionId: string): string | null {
    return this.activeCanvasSessions.get(sessionId) || null;
  }

  /**
   * Set active canvas user for a session
   */
  setActiveCanvasUser(sessionId: string, userId: string): void {
    this.activeCanvasSessions.set(sessionId, userId);
  }

  /**
   * Clear active canvas for a session
   */
  clearActiveCanvas(sessionId: string): void {
    this.activeCanvasSessions.delete(sessionId);
  }

  /**
   * Clear canvas state when user disconnects or leaves
   */
  clearCanvasOnUserLeave(userId: string, sessionId: string): void {
    const activeCanvasUser = this.activeCanvasSessions.get(sessionId);
    if (activeCanvasUser === userId) {
      this.activeCanvasSessions.delete(sessionId);
    }
  }

  /**
   * Close canvas when screen share starts (conflict resolution)
   */
  closeCanvasForScreenShare(sessionId: string): boolean {
    if (this.isCanvasActive(sessionId)) {
      this.activeCanvasSessions.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Get canvas state from database
   */
  async getCanvasState(sessionId: string): Promise<{
    operations: Array<{
      type: string;
      data: Record<string, unknown>;
      timestamp: string;
    }>;
    metadata: {
      width: number;
      height: number;
      backgroundColor: string;
    };
  } | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { whiteboard_data: true },
    });

    if (!session || !session.whiteboard_data) {
      return null;
    }

    const whiteboardData = session.whiteboard_data as {
      operations?: Array<{
        type: string;
        data: Record<string, unknown>;
        timestamp: string;
      }>;
      metadata?: {
        width: number;
        height: number;
        backgroundColor: string;
      };
    };

    return {
      operations: whiteboardData.operations || [],
      metadata: whiteboardData.metadata || {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
      },
    };
  }

  /**
   * Save canvas state to database
   * Enforces max operations limit and trims old operations if needed
   */
  async saveCanvasState(
    sessionId: string,
    canvasData: {
      operations: Array<{
        type: string;
        data: Record<string, unknown>;
        timestamp: string;
      }>;
      metadata: {
        width: number;
        height: number;
        backgroundColor: string;
      };
    },
  ): Promise<void> {
    const MAX_OPERATIONS = 1000;

    // Enforce operations limit - keep most recent operations
    let operations = canvasData.operations;
    if (operations.length > MAX_OPERATIONS) {
      operations = operations.slice(-MAX_OPERATIONS);
    }

    const trimmedCanvasData = {
      ...canvasData,
      operations,
    };

    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          whiteboard_data: trimmedCanvasData as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          `Session ${sessionId} not found when saving canvas state`,
        );
      }
      throw new BadRequestException(
        `Failed to save canvas state: ${error.message}`,
      );
    }
  }

  /**
   * Open canvas for a session
   * Returns the canvas state if it exists, or null if new canvas
   * Throws ForbiddenException if canvas is already active
   */
  async openCanvas(
    sessionId: string,
    userId: string,
  ): Promise<{
    operations: Array<{
      type: string;
      data: Record<string, unknown>;
      timestamp: string;
    }>;
    metadata: {
      width: number;
      height: number;
      backgroundColor: string;
    };
  } | null> {
    // Check if canvas is already active (race condition protection)
    if (this.isCanvasActive(sessionId)) {
      const activeCanvasUser = this.getActiveCanvasUser(sessionId);
      if (activeCanvasUser !== userId) {
        throw new ForbiddenException(
          'Canvas is already active in this session',
        );
      }
      // If same user, just return current state
      return await this.getCanvasState(sessionId);
    }

    // Set this user as active canvas user
    this.setActiveCanvasUser(sessionId, userId);

    // Load existing canvas state from database
    const canvasState = await this.getCanvasState(sessionId);
    return canvasState;
  }

  /**
   * Close canvas for a session
   * Optionally saves the current canvas state
   */
  async closeCanvas(
    sessionId: string,
    userId: string,
    canvasState?: {
      operations: Array<{
        type: string;
        data: Record<string, unknown>;
        timestamp: string;
      }>;
      metadata: {
        width: number;
        height: number;
        backgroundColor: string;
      };
    },
  ): Promise<void> {
    // Check if canvas is actually active
    if (!this.isCanvasActive(sessionId)) {
      throw new NotFoundException('Canvas is not active for this session');
    }

    // Check if this user is the active canvas user
    const activeCanvasUser = this.getActiveCanvasUser(sessionId);
    if (activeCanvasUser !== userId) {
      throw new ForbiddenException(
        'You are not the active canvas user for this session',
      );
    }

    // Save canvas state if provided
    if (canvasState) {
      await this.saveCanvasState(sessionId, canvasState);
    }

    // Clear active canvas
    this.clearActiveCanvas(sessionId);
  }

  /**
   * Clear canvas (remove all drawings)
   */
  async clearCanvas(sessionId: string, userId: string): Promise<void> {
    // Check if canvas is active
    if (!this.isCanvasActive(sessionId)) {
      throw new NotFoundException('Canvas is not active for this session');
    }

    // Check if this user is the active canvas user
    const activeCanvasUser = this.getActiveCanvasUser(sessionId);
    if (activeCanvasUser !== userId) {
      throw new ForbiddenException(
        'You are not the active canvas user for this session',
      );
    }

    // Clear canvas state in database
    const emptyCanvasState = {
      operations: [],
      metadata: {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
      },
    };

    await this.saveCanvasState(sessionId, emptyCanvasState);
  }

  /**
   * Save a meeting chat message to the database
   */
  async saveMeetingMessage(
    senderId: string,
    sessionId: string,
    content: string,
  ): Promise<{ id: string; sentAt: Date } | null> {
    try {
      const message = await this.prisma.message.create({
        data: {
          content,
          senderId,
          sessionId,
          type: 'MEETING',
        },
        select: {
          id: true,
          sentAt: true,
        },
      });

      return message;
    } catch (error) {
      console.error('Failed to save meeting message:', error);
      return null;
    }
  }

  /**
   * Save a classroom chat message to the database
   */
  async saveClassroomMessage(
    senderId: string,
    classId: string,
    content: string,
  ): Promise<{ id: string; sentAt: Date } | null> {
    try {
      const message = await this.prisma.message.create({
        data: {
          content,
          senderId,
          classId,
          type: 'CLASSROOM',
        },
        select: {
          id: true,
          sentAt: true,
        },
      });

      return message;
    } catch (error) {
      console.error('Failed to save classroom message:', error);
      return null;
    }
  }

  /**
   * Get recent meeting messages for a session
   */
  async getMeetingMessages(
    sessionId: string,
    limit: number = 50,
    before?: Date,
  ): Promise<
    Array<{
      id: string;
      content: string;
      sentAt: Date;
      sender: {
        id: string;
        full_name: string;
        avatar_url: string | null;
      };
    }>
  > {
    try {
      const messages = await this.prisma.message.findMany({
        where: {
          sessionId,
          type: 'MEETING',
          ...(before && { sentAt: { lt: before } }),
        },
        include: {
          sender: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
            },
          },
        },
        orderBy: {
          sentAt: 'desc',
        },
        take: limit,
      });

      return messages.reverse();
    } catch (error) {
      console.error('Failed to get meeting messages:', error);
      return [];
    }
  }

  /**
   * Get recent classroom messages for a class
   */
  async getClassroomMessages(
    classId: string,
    limit: number = 50,
    before?: Date,
  ): Promise<
    Array<{
      id: string;
      content: string;
      sentAt: Date;
      sender: {
        id: string;
        full_name: string;
        avatar_url: string | null;
      };
    }>
  > {
    try {
      const messages = await this.prisma.message.findMany({
        where: {
          classId,
          type: 'CLASSROOM',
          ...(before && { sentAt: { lt: before } }),
        },
        include: {
          sender: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
            },
          },
        },
        orderBy: {
          sentAt: 'desc',
        },
        take: limit,
      });

      return messages.reverse();
    } catch (error) {
      console.error('Failed to get classroom messages:', error);
      return [];
    }
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.userService.getUserDetails(userId);
    return user?.role === 'ADMIN';
  }

  /**
   * Check if user is teacher in a session's class
   */
  async isTeacherInSession(
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          class: {
            include: {
              teachers: true,
            },
          },
        },
      });

      if (!session) return false;

      const user = await this.userService.getUserDetails(userId);
      if (user?.role === 'ADMIN') return true;

      return (
        session.host_id === userId ||
        session.class.created_by === userId ||
        session.class.teachers.some((t) => t.teacher_id === userId)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if target user is a student
   */
  async isStudent(userId: string): Promise<boolean> {
    const user = await this.userService.getUserDetails(userId);
    return user?.role === 'STUDENT';
  }

  /**
   * Check if user can kick another user from session
   * Admin can kick all, teacher can kick students
   */
  async canKickParticipant(
    requesterId: string,
    targetUserId: string,
    sessionId: string,
  ): Promise<boolean> {
    const isRequesterAdmin = await this.isAdmin(requesterId);
    if (isRequesterAdmin) return true;

    const isRequesterTeacher = await this.isTeacherInSession(
      requesterId,
      sessionId,
    );
    if (!isRequesterTeacher) return false;

    const isTargetStudent = await this.isStudent(targetUserId);
    return isTargetStudent;
  }

  /**
   * Check if user can control media of another user
   * Admin and teacher can control student media
   */
  async canControlParticipantMedia(
    requesterId: string,
    targetUserId: string,
    sessionId: string,
  ): Promise<boolean> {
    const isRequesterAdmin = await this.isAdmin(requesterId);
    if (isRequesterAdmin) return true;

    const isRequesterTeacher = await this.isTeacherInSession(
      requesterId,
      sessionId,
    );
    if (!isRequesterTeacher) return false;

    const isTargetStudent = await this.isStudent(targetUserId);
    return isTargetStudent;
  }

  /**
   * Kick a participant from the session
   */
  async kickParticipant(
    requesterId: string,
    targetUserId: string,
    sessionId: string,
  ): Promise<void> {
    const canKick = await this.canKickParticipant(
      requesterId,
      targetUserId,
      sessionId,
    );
    if (!canKick) {
      throw new ForbiddenException(
        'You do not have permission to kick this participant',
      );
    }

    const roomName = this.liveKitService.buildRoomName(sessionId);
    await this.liveKitService.removeParticipant(roomName, targetUserId);

    // Remove from connected users if present
    const targetUser = this.connectedUsersManager.getUser(
      targetUserId,
      sessionId,
    );
    if (targetUser) {
      this.connectedUsersManager.removeUserBySocket(targetUser.socketId);
    }
  }

  /**
   * Stop a participant's media (audio/video)
   */
  async stopParticipantMedia(
    requesterId: string,
    targetUserId: string,
    sessionId: string,
    mediaType: 'audio' | 'video' | 'both',
  ): Promise<void> {
    const canControl = await this.canControlParticipantMedia(
      requesterId,
      targetUserId,
      sessionId,
    );
    if (!canControl) {
      throw new ForbiddenException(
        "You do not have permission to control this participant's media",
      );
    }

    const roomName = this.liveKitService.buildRoomName(sessionId);
    const tracks = await this.liveKitService.getParticipantTracks(
      roomName,
      targetUserId,
    );

    if (tracks.length === 0) {
      return; // Participant has no tracks to mute
    }

    for (const track of tracks) {
      if (
        mediaType === 'both' ||
        (mediaType === 'audio' && track.type === 'audio') ||
        (mediaType === 'video' && track.type === 'video')
      ) {
        await this.liveKitService.mutePublishedTrack(
          roomName,
          targetUserId,
          track.sid,
          true,
        );
      }
    }
  }

  /**
   * Start recording a session
   */
  async startRecording(
    requesterId: string,
    sessionId: string,
  ): Promise<string> {
    const isRequesterAdmin = await this.isAdmin(requesterId);
    const isRequesterTeacher = await this.isTeacherInSession(
      requesterId,
      sessionId,
    );

    if (!isRequesterAdmin && !isRequesterTeacher) {
      throw new ForbiddenException(
        'Only admins and teachers can start recording',
      );
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const roomName = this.liveKitService.buildRoomName(sessionId);
    const egressId = await this.liveKitService.startRoomRecording(roomName);

    // Update session to mark as recorded
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        is_recorded: true,
        metadata: {
          ...((session.metadata as Record<string, unknown>) || {}),
          recordingEgressId: egressId,
          recordingStartedAt: new Date().toISOString(),
        },
      },
    });

    return egressId;
  }

  /**
   * Stop recording a session
   */
  async stopRecording(requesterId: string, sessionId: string): Promise<void> {
    const isRequesterAdmin = await this.isAdmin(requesterId);
    const isRequesterTeacher = await this.isTeacherInSession(
      requesterId,
      sessionId,
    );

    if (!isRequesterAdmin && !isRequesterTeacher) {
      throw new ForbiddenException(
        'Only admins and teachers can stop recording',
      );
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const metadata = (session.metadata as Record<string, unknown>) || {};
    const egressId = metadata.recordingEgressId as string | undefined;

    if (!egressId) {
      throw new NotFoundException('No active recording found for this session');
    }

    await this.liveKitService.stopRecording(egressId);

    // Update session metadata
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        metadata: {
          ...metadata,
          recordingStoppedAt: new Date().toISOString(),
        },
      },
    });
  }
}
