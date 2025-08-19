import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { userPayload } from 'src/common/types/userPayload.interface';
import { ResponseDto } from 'src/common/dto/response.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session
   */
  async createSession(
    user: userPayload,
    dto: CreateSessionDto,
  ): Promise<ResponseDto> {
    try {
      const hasPermission = await this.checkClassPermission(
        dto.class_id,
        user.id,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can create sessions',
        );
      }

      const session = await this.prisma.session.create({
        data: {
          class_id: dto.class_id,
          host_id: user.id,
          start_time: new Date(dto.start_time),
          end_time: dto.end_time ? new Date(dto.end_time) : null,
          is_recorded: dto.is_recorded || false,
          metadata: dto.metadata || {},
        },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          host: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
      });

      return ResponseDto.ok(session, 'Session created successfully');
    } catch (error) {
      console.error('Error creating session:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error('Failed to create session');
    }
  }

  /**
   * Get all sessions for a class
   */
  async getClassSessions(
    classId: string,
    userId: string,
  ): Promise<ResponseDto> {
    try {
      const hasAccess = await this.checkClassAccess(classId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this class');
      }

      const sessions = await this.prisma.session.findMany({
        where: { class_id: classId },
        include: {
          host: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { start_time: 'desc' },
      });

      return ResponseDto.ok(sessions, 'Sessions retrieved successfully');
    } catch (error) {
      console.error('Error getting class sessions:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error('Failed to retrieve sessions');
    }
  }

  /**
   * Get session by ID
   */
  async getSessionById(
    sessionId: string,
    userId: string,
  ): Promise<ResponseDto> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          class: {
            include: {
              creator: {
                select: { id: true, full_name: true, email: true },
              },
              members: {
                include: {
                  student: {
                    select: {
                      id: true,
                      full_name: true,
                      email: true,
                      avatar_url: true,
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
                      email: true,
                      avatar_url: true,
                    },
                  },
                },
              },
            },
          },
          host: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      const hasAccess = this.checkSessionAccess(session, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this session');
      }

      return ResponseDto.ok(session, 'Session details retrieved successfully');
    } catch (error) {
      console.error('Error getting session:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to retrieve session');
    }
  }

  /**
   * Update session details
   */
  async updateSession(
    sessionId: string,
    userId: string,
    dto: UpdateSessionDto,
  ): Promise<ResponseDto> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          class: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      const canModify = await this.checkSessionModifyPermission(
        session,
        userId,
      );
      if (!canModify) {
        throw new ForbiddenException(
          'Only session host, class creator, or teachers can modify sessions',
        );
      }

      const updateData: any = {};

      if (dto.start_time) updateData.start_time = new Date(dto.start_time);
      if (dto.end_time) updateData.end_time = new Date(dto.end_time);
      if (dto.is_recorded !== undefined)
        updateData.is_recorded = dto.is_recorded;
      if (dto.recording_url) updateData.recording_url = dto.recording_url;
      if (dto.whiteboard_data) updateData.whiteboard_data = dto.whiteboard_data;
      if (dto.metadata) updateData.metadata = dto.metadata;

      const updatedSession = await this.prisma.session.update({
        where: { id: sessionId },
        data: updateData,
        include: {
          class: {
            select: {
              id: true,
              name: true,
            },
          },
          host: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
      });

      return ResponseDto.ok(updatedSession, 'Session updated successfully');
    } catch (error) {
      console.error('Error updating session:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to update session');
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string, userId: string): Promise<ResponseDto> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          class: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      if (session.host_id !== userId && session.class.created_by !== userId) {
        throw new ForbiddenException(
          'Only session host or class creator can delete sessions',
        );
      }

      await this.prisma.session.delete({
        where: { id: sessionId },
      });

      return ResponseDto.ok(null, 'Session deleted successfully');
    } catch (error) {
      console.error('Error deleting session:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to delete session');
    }
  }

  /**
   * Get user's upcoming sessions
   */
  async getUserUpcomingSessions(userId: string): Promise<ResponseDto> {
    try {
      const now = new Date();

      const hostedSessions = await this.prisma.session.findMany({
        where: {
          host_id: userId,
          start_time: { gte: now },
        },
        include: {
          class: {
            select: { id: true, name: true },
          },
        },
        orderBy: { start_time: 'asc' },
      });

      const memberSessions = await this.prisma.session.findMany({
        where: {
          start_time: { gte: now },
          class: {
            OR: [
              { created_by: userId },
              { teachers: { some: { teacher_id: userId } } },
              { members: { some: { student_id: userId, status: 'active' } } },
            ],
          },
        },
        include: {
          class: {
            select: { id: true, name: true },
          },
          host: {
            select: { id: true, full_name: true },
          },
        },
        orderBy: { start_time: 'asc' },
      });

      // Combine and deduplicate
      const allSessions = [...hostedSessions, ...memberSessions];
      const uniqueSessions = allSessions.filter(
        (session, index, self) =>
          index === self.findIndex((s) => s.id === session.id),
      );

      return ResponseDto.ok(
        uniqueSessions,
        'Upcoming sessions retrieved successfully',
      );
    } catch (error) {
      console.error('Error getting upcoming sessions:', error);
      throw new Error('Failed to retrieve upcoming sessions');
    }
  }

  /**
   * End a session (set end time to now)
   */
  async endSession(sessionId: string, userId: string): Promise<ResponseDto> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: { class: true },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      const canModify = await this.checkSessionModifyPermission(
        session,
        userId,
      );
      if (!canModify) {
        throw new ForbiddenException(
          'Only session host, class creator, or teachers can end sessions',
        );
      }

      if (session.end_time && session.end_time < new Date()) {
        throw new ForbiddenException('Session has already ended');
      }

      const updatedSession = await this.prisma.session.update({
        where: { id: sessionId },
        data: { end_time: new Date() },
        include: {
          class: {
            select: { id: true, name: true },
          },
          host: {
            select: { id: true, full_name: true },
          },
        },
      });

      return ResponseDto.ok(updatedSession, 'Session ended successfully');
    } catch (error) {
      console.error('Error ending session:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to end session');
    }
  }

  /**
   * Helper: Check if user has permission to create sessions in a class
   */
  private async checkClassPermission(
    classId: string,
    userId: string,
  ): Promise<boolean> {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        teachers: true,
      },
    });

    if (!classData) return false;

    return (
      classData.created_by === userId ||
      classData.teachers.some((t) => t.teacher_id === userId)
    );
  }

  /**
   * Helper: Check if user has access to a class
   */
  private async checkClassAccess(
    classId: string,
    userId: string,
  ): Promise<boolean> {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        teachers: true,
        members: true,
      },
    });

    if (!classData) return false;

    return (
      classData.created_by === userId ||
      classData.teachers.some((t) => t.teacher_id === userId) ||
      classData.members.some(
        (m) => m.student_id === userId && m.status === 'active',
      )
    );
  }

  /**
   * Helper: Check if user has access to a session
   */
  private checkSessionAccess(session: any, userId: string): boolean {
    // Host
    if (session.host_id === userId) return true;

    // Class creator
    if (session.class.created_by === userId) return true;

    // Teacher
    if (session.class.teachers.some((t: any) => t.teacher_id === userId))
      return true;

    // Active student
    if (
      session.class.members.some(
        (m: any) => m.student_id === userId && m.status === 'active',
      )
    )
      return true;

    return false;
  }

  /**
   * Helper: Check if user can modify a session
   */
  private async checkSessionModifyPermission(
    session: any,
    userId: string,
  ): Promise<boolean> {
    // Host
    if (session.host_id === userId) return true;

    // Class creator
    if (session.class.created_by === userId) return true;

    // Check if user is a teacher
    const isTeacher = await this.prisma.classTeacher.findFirst({
      where: {
        class_id: session.class_id,
        teacher_id: userId,
      },
    });

    return !!isTeacher;
  }
}
