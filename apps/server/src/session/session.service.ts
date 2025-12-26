import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { userPayload } from 'src/common/types/userPayload.interface';
import { Role } from 'src/common/enum/role.enum';
import { ResponseDto } from 'src/common/dto/response.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { Session } from '@prisma/client';
import { SessionResponseDto } from './dto/session-response.dto';
import { PaginationDto, PaginatedResponse } from './dto/pagination.dto';
import {
  AttendanceRecordDto,
  SessionAttendanceSummaryDto,
} from './dto/attendance.dto';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job: cleanup old sessions.
   *
   * - Any session whose end_time (or start_time if no end_time) is older than 7 days
   *   will be deleted.
   *
   * Note: `end_time = null` represents an ongoing session. We must NOT auto-end those
   * just because `start_time <= now`, otherwise sessions will be ended immediately
   * after they start.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleSessionLifecycleMaintenance(): Promise<void> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      await this.prisma.$transaction([
        // Delete sessions that ended more than a week ago,
        // or (for safety) sessions older than a week with no end_time
        this.prisma.session.deleteMany({
          where: {
            OR: [
              {
                end_time: {
                  lte: weekAgo,
                },
              },
              {
                end_time: null,
                start_time: {
                  lte: weekAgo,
                },
              },
            ],
          },
        }),
      ]);
    } catch (error) {
      // Log but do not crash the app – maintenance is best-effort
      console.error('Error running session lifecycle maintenance cron:', error);
    }
  }

  /**
   * Create a new session
   */
  async createSession(
    user: userPayload,
    dto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    try {
      const hasPermission = await this.checkClassPermission(
        dto.class_id,
        user.id,
        user.role,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only teachers and admins can create sessions',
        );
      }

      // Validate start_time
      const startTime = new Date(dto.start_time);
      if (isNaN(startTime.getTime())) {
        throw new UnprocessableEntityException('Invalid start_time format');
      }

      // Validate end_time if provided
      let endTime: Date | null = null;
      if (dto.end_time !== undefined) {
        endTime = new Date(dto.end_time);
        if (isNaN(endTime.getTime())) {
          throw new UnprocessableEntityException('Invalid end_time format');
        }
        if (endTime <= startTime) {
          throw new UnprocessableEntityException(
            'end_time must be after start_time',
          );
        }
      }

      // Check for session conflicts (overlapping sessions)
      await this.checkSessionConflicts(
        dto.class_id,
        user.id,
        startTime,
        endTime,
      );

      const sessionData: any = {
        class_id: dto.class_id,
        host_id: user.id,
        start_time: startTime,
        // Prisma schema requires is_recorded (no default), so enforce false when omitted
        is_recorded: dto.is_recorded ?? false,
      };

      // Only set optional fields if explicitly provided
      if (dto.end_time !== undefined) {
        sessionData.end_time = endTime;
      }
      if (dto.metadata !== undefined) {
        sessionData.metadata = dto.metadata;
      }

      const session: SessionResponseDto = await this.prisma.session.create({
        data: sessionData,
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

      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create session');
    }
  }

  /**
   * Get all sessions for a class (with pagination)
   */
  async getClassSessions(
    classId: string,
    userId: string,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    try {
      const hasAccess = await this.checkClassAccess(classId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this class');
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;

      const [sessions, total] = await Promise.all([
        this.prisma.session.findMany({
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
          skip,
          take: limit,
        }),
        this.prisma.session.count({
          where: { class_id: classId },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting class sessions:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve sessions');
    }
  }

  /**
   * Get session by ID
   */
  async getSessionById(
    sessionId: string,
    userId: string,
  ): Promise<SessionResponseDto> {
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

      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve session');
    }
  }

  /**
   * Update session details
   */
  async updateSession(
    sessionId: string,
    userId: string,
    dto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
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

      // Validate and update start_time if provided
      if (dto.start_time) {
        const newStartTime = new Date(dto.start_time);
        if (isNaN(newStartTime.getTime())) {
          throw new UnprocessableEntityException('Invalid start_time format');
        }
        updateData.start_time = newStartTime;
      }

      // Validate and update end_time if provided
      let newEndTime: Date | null = null;
      if (dto.end_time !== undefined) {
        newEndTime = dto.end_time ? new Date(dto.end_time) : null;
        if (dto.end_time && isNaN(newEndTime!.getTime())) {
          throw new UnprocessableEntityException('Invalid end_time format');
        }
        const effectiveStartTime = updateData.start_time || session.start_time;
        if (newEndTime && newEndTime <= effectiveStartTime) {
          throw new UnprocessableEntityException(
            'end_time must be after start_time',
          );
        }
        updateData.end_time = newEndTime;
      }

      // Check for conflicts if time is being changed
      if (dto.start_time || dto.end_time !== undefined) {
        const effectiveStartTime = updateData.start_time || session.start_time;
        const effectiveEndTime = newEndTime ?? session.end_time;
        await this.checkSessionConflicts(
          session.class_id,
          session.host_id,
          effectiveStartTime,
          effectiveEndTime,
          sessionId,
        );
      }

      if (dto.is_recorded !== undefined)
        updateData.is_recorded = dto.is_recorded;
      if (dto.recording_url !== undefined)
        updateData.recording_url = dto.recording_url;
      if (dto.whiteboard_data !== undefined)
        updateData.whiteboard_data = dto.whiteboard_data;
      if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

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

      return updatedSession;
    } catch (error) {
      console.error('Error updating session:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update session');
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
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

      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete session');
    }
  }

  /**
   * Get user's upcoming sessions
   */
  async getUserUpcomingSessions(userId: string): Promise<SessionResponseDto[]> {
    try {
      const now = new Date();

      const hostedSessions: SessionResponseDto[] =
        await this.prisma.session.findMany({
          where: {
            host_id: userId,
            start_time: { gte: now },
          },
          include: {
            class: {
              select: { id: true, name: true },
            },
            host: {
              select: { id: true, full_name: true, email: true },
            },
          },
          orderBy: { start_time: 'asc' },
        });

      const memberSessions: SessionResponseDto[] =
        await this.prisma.session.findMany({
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
              select: { id: true, full_name: true, email: true },
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

      return uniqueSessions;
    } catch (error) {
      console.error('Error getting upcoming sessions:', error);
      throw new UnprocessableEntityException(
        'Failed to retrieve upcoming sessions',
      );
    }
  }

  /**
   * End a session (set end time to now)
   */
  async endSession(
    sessionId: string,
    userId: string,
  ): Promise<SessionResponseDto> {
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

      // Check if session is already ended
      if (session.end_time && session.end_time <= new Date()) {
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
            select: { id: true, full_name: true, email: true },
          },
        },
      });

      return updatedSession;
    } catch (error) {
      console.error('Error ending session:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to end session');
    }
  }

  /**
   * Check for session conflicts (overlapping sessions)
   */
  private async checkSessionConflicts(
    classId: string,
    hostId: string,
    startTime: Date,
    endTime: Date | null,
    excludeSessionId?: string,
  ): Promise<void> {
    // Use a far future date if endTime is null (ongoing session)
    const effectiveEndTime = endTime || new Date('2099-12-31');

    // Check for overlapping sessions in the same class
    // Two sessions overlap if:
    // - New session starts before existing session ends AND
    // - New session ends after existing session starts
    const classConflict = await this.prisma.session.findFirst({
      where: {
        class_id: classId,
        ...(excludeSessionId && { id: { not: excludeSessionId } }),
        AND: [
          { start_time: { lt: effectiveEndTime } },
          {
            OR: [
              { end_time: { gt: startTime } },
              { end_time: null }, // Ongoing sessions conflict
            ],
          },
        ],
      },
    });

    if (classConflict) {
      throw new UnprocessableEntityException(
        'Session conflicts with another session in the same class. Please choose a different time.',
      );
    }

    // Check for overlapping sessions with the same host
    const hostConflict = await this.prisma.session.findFirst({
      where: {
        host_id: hostId,
        ...(excludeSessionId && { id: { not: excludeSessionId } }),
        AND: [
          { start_time: { lt: effectiveEndTime } },
          {
            OR: [
              { end_time: { gt: startTime } },
              { end_time: null }, // Ongoing sessions conflict
            ],
          },
        ],
      },
    });

    if (hostConflict) {
      throw new UnprocessableEntityException(
        'You already have another session scheduled at this time. Please choose a different time.',
      );
    }
  }

  /**
   * Helper: Check if user has permission to create sessions in a class
   */
  private async checkClassPermission(
    classId: string,
    userId: string,
    userRole?: Role,
  ): Promise<boolean> {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        created_by: true,
      },
    });

    if (!classData) return false;

    // Teachers/admins can create sessions (role-based, per controller docs)
    if (userRole === Role.ADMIN || userRole === Role.TEACHER) return true;

    // Check if user is the class creator
    if (classData.created_by === userId) return true;

    // Check if user is a teacher in the class
    const isTeacher = await this.prisma.classTeacher.findFirst({
      where: {
        class_id: classId,
        teacher_id: userId,
      },
    });

    return !!isTeacher;
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

  /**
   * Get all sessions (for teachers/admins only) (with pagination)
   */
  async getAllSessions(
    userId: string,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    try {
      // Check if user is a teacher or admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new ForbiddenException('User not found');
      }

      if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
        throw new ForbiddenException(
          'Only teachers and admins can access all sessions',
        );
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;

      const [sessions, total] = await Promise.all([
        this.prisma.session.findMany({
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
          skip,
          take: limit,
        }),
        this.prisma.session.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting all sessions:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve all sessions');
    }
  }

  /**
   * Get all user sessions (hosted, attended, upcoming, past) (with pagination)
   */
  async getAllUserSessions(
    userId: string,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;

      const whereCondition = {
        OR: [
          { host_id: userId },
          {
            class: {
              OR: [
                { created_by: userId },
                { teachers: { some: { teacher_id: userId } } },
                {
                  members: {
                    some: { student_id: userId, status: 'active' },
                  },
                },
              ],
            },
          },
        ],
      };

      const [sessions, total] = await Promise.all([
        this.prisma.session.findMany({
          where: whereCondition,
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
          skip,
          take: limit,
        }),
        this.prisma.session.count({
          where: whereCondition,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting all user sessions:', error);
      throw new InternalServerErrorException(
        'Failed to retrieve user sessions',
      );
    }
  }

  /**
   * Record user attendance when joining a session
   */
  async recordAttendance(
    sessionId: string,
    userId: string,
  ): Promise<AttendanceRecordDto> {
    try {
      // Check if session exists and user has access
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: { class: true },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      const hasAccess = this.checkSessionAccess(session, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this session');
      }

      // Check if attendance already recorded
      const existing = await (this.prisma as any).sessionAttendance.findUnique({
        where: {
          session_id_user_id: {
            session_id: sessionId,
            user_id: userId,
          },
        },
      });

      if (existing) {
        // Update left_at to null if user rejoins
        const updated = await (this.prisma as any).sessionAttendance.update({
          where: { id: existing.id },
          data: { left_at: null },
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

        return {
          id: updated.id,
          session_id: updated.session_id,
          user_id: updated.user_id,
          joined_at: updated.joined_at,
          left_at: updated.left_at || undefined,
          duration_seconds: updated.duration_seconds || undefined,
          is_attended: updated.is_attended || false,
          attended_at: updated.attended_at || undefined,
          user: updated.user,
        };
      }

      // Create new attendance record
      const attendance = await (this.prisma as any).sessionAttendance.create({
        data: {
          session_id: sessionId,
          user_id: userId,
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

      return {
        id: attendance.id,
        session_id: attendance.session_id,
        user_id: attendance.user_id,
        joined_at: attendance.joined_at,
        left_at: attendance.left_at || undefined,
        duration_seconds: attendance.duration_seconds || undefined,
        is_attended: attendance.is_attended || false,
        attended_at: attendance.attended_at || undefined,
        user: attendance.user,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to record attendance');
    }
  }

  /**
   * Mark user as attended (after 5 minutes of joining)
   */
  async markAsAttended(sessionId: string, userId: string): Promise<void> {
    try {
      const attendance = await (
        this.prisma as any
      ).sessionAttendance.findUnique({
        where: {
          session_id_user_id: {
            session_id: sessionId,
            user_id: userId,
          },
        },
      });

      if (!attendance) {
        return; // No attendance record found, nothing to update
      }

      // Only mark if not already marked and user hasn't left
      if (!attendance.is_attended && !attendance.left_at) {
        await (this.prisma as any).sessionAttendance.update({
          where: { id: attendance.id },
          data: {
            is_attended: true,
            attended_at: new Date(),
          },
        });
      }
    } catch (error) {
      console.error('Error marking user as attended:', error);
      // Don't throw - this is best effort
    }
  }

  /**
   * Record user leaving a session
   */
  async recordLeave(sessionId: string, userId: string): Promise<void> {
    try {
      const attendance = await (
        this.prisma as any
      ).sessionAttendance.findUnique({
        where: {
          session_id_user_id: {
            session_id: sessionId,
            user_id: userId,
          },
        },
      });

      if (!attendance) {
        return; // No attendance record found, nothing to update
      }

      if (attendance.left_at) {
        return; // Already left
      }

      const leftAt = new Date();
      const joinedAt = attendance.joined_at;
      const durationSeconds = Math.floor(
        (leftAt.getTime() - joinedAt.getTime()) / 1000,
      );

      await (this.prisma as any).sessionAttendance.update({
        where: { id: attendance.id },
        data: {
          left_at: leftAt,
          duration_seconds: durationSeconds,
        },
      });
    } catch (error) {
      console.error('Error recording leave:', error);
      // Don't throw - this is best effort
    }
  }

  /**
   * Get attendance summary for a session
   */
  async getSessionAttendance(
    sessionId: string,
    userId: string,
  ): Promise<SessionAttendanceSummaryDto> {
    try {
      // Check if session exists and user has access
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: { class: true },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      const hasAccess = this.checkSessionAccess(session, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this session');
      }

      const attendances = await (this.prisma as any).sessionAttendance.findMany(
        {
          where: { session_id: sessionId },
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
          orderBy: { joined_at: 'asc' },
        },
      );

      const activeAttendees = attendances.filter((a) => !a.left_at).length;
      const totalAttendees = attendances.length;
      const attendedCount = attendances.filter((a) => a.is_attended).length;

      const durations = attendances
        .filter((a) => a.duration_seconds !== null)
        .map((a) => a.duration_seconds!);
      const averageDuration =
        durations.length > 0
          ? Math.floor(
              durations.reduce((sum, d) => sum + d, 0) / durations.length,
            )
          : 0;

      const attendeeRecords: AttendanceRecordDto[] = attendances.map((a) => ({
        id: a.id,
        session_id: a.session_id,
        user_id: a.user_id,
        joined_at: a.joined_at,
        left_at: a.left_at || undefined,
        duration_seconds: a.duration_seconds || undefined,
        is_attended: a.is_attended || false,
        attended_at: a.attended_at || undefined,
        user: a.user,
      }));

      return {
        session_id: sessionId,
        total_attendees: totalAttendees,
        active_attendees: activeAttendees,
        attended_count: attendedCount,
        average_duration_seconds: averageDuration,
        attendees: attendeeRecords,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get attendance');
    }
  }

  /**
   * Get user's attendance records across all sessions
   */
  async getUserAttendance(
    userId: string,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponse<AttendanceRecordDto>> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;

      const [attendances, total] = await Promise.all([
        (this.prisma as any).sessionAttendance.findMany({
          where: { user_id: userId },
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                avatar_url: true,
              },
            },
            session: {
              select: {
                id: true,
                class_id: true,
                start_time: true,
                end_time: true,
              },
            },
          },
          orderBy: { joined_at: 'desc' },
          skip,
          take: limit,
        }),
        (this.prisma as any).sessionAttendance.count({
          where: { user_id: userId },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: attendances.map((a) => ({
          id: a.id,
          session_id: a.session_id,
          user_id: a.user_id,
          joined_at: a.joined_at,
          left_at: a.left_at || undefined,
          duration_seconds: a.duration_seconds || undefined,
          is_attended: a.is_attended || false,
          attended_at: a.attended_at || undefined,
          user: a.user,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to get user attendance');
    }
  }
}
