import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
}
