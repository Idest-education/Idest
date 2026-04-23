import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ClassCountDto,
  ClassResponseDto,
  FullClassResponseDto,
  PaginatedClassResponseDto,
  UserClassesResponseDto,
  UserSummaryDto,
} from '../dto/class-response.dto';
import {
  checkClassAccess,
  checkClassAccessById,
  mapUsersToDto,
  toFullClassResponseDto,
} from '../class.util';
import {
  ClassCalendarEventDto,
  ClassCalendarEventsResponseDto,
} from '../dto/calendar-events.dto';

type ClassScheduleShape = {
  days: string[];
  time: string;
  duration: number;
  timezone?: string;
};

@Injectable()
export class ClassQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private parseSchedule(value: unknown): ClassScheduleShape | null {
    if (!value || typeof value !== 'object') return null;
    const maybe = value as Record<string, unknown>;
    const days = Array.isArray(maybe.days)
      ? maybe.days.filter((d): d is string => typeof d === 'string')
      : [];
    const time = typeof maybe.time === 'string' ? maybe.time : undefined;
    const duration =
      typeof maybe.duration === 'number' && maybe.duration > 0
        ? maybe.duration
        : undefined;
    const timezone =
      typeof maybe.timezone === 'string' ? maybe.timezone : undefined;

    if (!time || !duration || days.length === 0) return null;
    return { days, time, duration, timezone };
  }

  private getWeekdayIndex(day: string): number | null {
    const normalized = day.trim().toLowerCase();
    const map: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      // Vietnamese aliases
      'chủ nhật': 0,
      'thu hai': 1,
      'thứ hai': 1,
      'thu ba': 2,
      'thứ ba': 2,
      'thu tu': 3,
      'thứ tư': 3,
      'thu nam': 4,
      'thứ năm': 4,
      'thu sau': 5,
      'thứ sáu': 5,
      'thu bay': 6,
      'thứ bảy': 6,
    };
    return normalized in map ? map[normalized] : null;
  }

  private buildDateAtTime(
    baseDate: Date,
    time: string,
    durationMinutes: number,
  ): { start: Date; end: Date } | null {
    const [hourRaw, minuteRaw] = time.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    const start = new Date(baseDate);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return { start, end };
  }

  private normalizeRange(from?: string, to?: string): { fromDate: Date; toDate: Date } {
    const fromDate = from ? new Date(from) : new Date();
    if (Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException('Invalid "from" datetime');
    }

    const toDate = to
      ? new Date(to)
      : new Date(fromDate.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid "to" datetime');
    }
    if (toDate <= fromDate) {
      throw new BadRequestException('"to" must be after "from"');
    }

    // Keep range bounded to avoid heavy payloads.
    const maxRangeMs = 180 * 24 * 60 * 60 * 1000;
    if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
      throw new BadRequestException('Date range is too large (max 180 days)');
    }

    return { fromDate, toDate };
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'ADMIN';
  }

  /**
   * Get class by slug with full details
   */
  async getClassBySlug(
    slug: string,
    userId: string,
  ): Promise<FullClassResponseDto> {
    try {
      const classData = await this.prisma.class.findFirst({
        where: { slug },
        include: {
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
              role: true,
            },
          },
          members: {
            include: {
              student: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
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
                  email: true,
                  avatar_url: true,
                  role: true,
                },
              },
            },
          },
          sessions: {
            orderBy: { created_at: 'desc' },
            include: {
              host: {
                select: { id: true, full_name: true, email: true },
              },
            },
          },
          _count: {
            select: {
              members: true,
              teachers: true,
              sessions: true,
            },
          },
        },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      const hasAccess = (await this.isAdmin(userId)) || checkClassAccess(classData, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this class');
      }

      return toFullClassResponseDto(classData);
    } catch (error) {
      console.error('Error getting class by slug:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve class');
    }
  }

  /**
   * Get all classes for a user (as creator, teacher, or student)
   */
  async getUserClasses(userId: string): Promise<UserClassesResponseDto> {
    try {
      // Get classes where user is creator
      const createdClasses = await this.prisma.class.findMany({
        where: { created_by: userId },
        include: {
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
              role: true,
            },
          },
          members: {
            include: {
              student: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
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
                  email: true,
                  avatar_url: true,
                  role: true,
                },
              },
            },
          },
          sessions: {
            orderBy: { created_at: 'desc' },
            include: {
              host: {
                select: { id: true, full_name: true, email: true },
              },
            },
          },
          _count: {
            select: { members: true, teachers: true, sessions: true },
          },
        },
      });

      // Get classes where user is a teacher
      const teachingClasses = await this.prisma.class.findMany({
        where: {
          teachers: {
            some: { teacher_id: userId },
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
              role: true,
            },
          },
          members: {
            include: {
              student: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
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
                  email: true,
                  avatar_url: true,
                  role: true,
                },
              },
            },
          },
          sessions: {
            orderBy: { created_at: 'desc' },
            include: {
              host: {
                select: { id: true, full_name: true, email: true },
              },
            },
          },
          _count: {
            select: { members: true, teachers: true, sessions: true },
          },
        },
      });

      // Get classes where user is a student
      const studentClasses = await this.prisma.class.findMany({
        where: {
          members: {
            some: {
              student_id: userId,
              status: 'active',
            },
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
              role: true,
            },
          },
          members: {
            include: {
              student: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
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
                  email: true,
                  avatar_url: true,
                  role: true,
                },
              },
            },
          },
          sessions: {
            orderBy: { created_at: 'desc' },
            include: {
              host: {
                select: { id: true, full_name: true, email: true },
              },
            },
          },
          _count: {
            select: { members: true, teachers: true, sessions: true },
          },
        },
      });

      const classes = {
        created: createdClasses.map(toFullClassResponseDto),
        teaching: teachingClasses.map(toFullClassResponseDto),
        enrolled: studentClasses.map(toFullClassResponseDto),
      };

      return classes;
    } catch (error) {
      console.error('Error getting user classes:', error);
      throw new InternalServerErrorException('Failed to retrieve classes');
    }
  }

  async getCalendarEventsForUser(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<ClassCalendarEventsResponseDto> {
    try {
      const { fromDate, toDate } = this.normalizeRange(from, to);
      const eventMap = new Map<string, ClassCalendarEventDto>();

      const userClasses = await this.prisma.class.findMany({
        where: {
          OR: [
            { created_by: userId },
            { teachers: { some: { teacher_id: userId } } },
            { members: { some: { student_id: userId, status: 'active' } } },
          ],
        },
        select: {
          id: true,
          name: true,
          schedule: true,
        },
      });

      if (userClasses.length === 0) {
        return {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          total: 0,
          events: [],
        };
      }

      const classIds = userClasses.map((c) => c.id);
      const sessions = await this.prisma.session.findMany({
        where: {
          class_id: { in: classIds },
          start_time: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          class_id: true,
          start_time: true,
          end_time: true,
          class: { select: { id: true, name: true } },
        },
        orderBy: { start_time: 'asc' },
      });

      // Add concrete sessions first so recurring events can be deduped against them.
      for (const session of sessions) {
        const endTime =
          session.end_time ?? new Date(session.start_time.getTime() + 60 * 60 * 1000);
        const key = `${session.class_id}|${session.start_time.toISOString()}`;
        eventMap.set(key, {
          id: `session_${session.id}`,
          title: session.class.name,
          start: session.start_time.toISOString(),
          end: endTime.toISOString(),
          source: 'session',
          classId: session.class_id,
          className: session.class.name,
          timezone: null,
        });
      }

      for (const classItem of userClasses) {
        const schedule = this.parseSchedule(classItem.schedule);
        if (!schedule) continue;
        const { time, duration } = schedule;

        const validWeekdays = schedule.days
          .map((d) => this.getWeekdayIndex(d))
          .filter((d): d is number => d !== null);
        if (validWeekdays.length === 0) continue;

        const cursor = new Date(fromDate);
        cursor.setHours(0, 0, 0, 0);

        while (cursor <= toDate) {
          if (validWeekdays.includes(cursor.getDay())) {
            const slot = this.buildDateAtTime(cursor, time, duration);
            if (slot && slot.start >= fromDate && slot.start <= toDate) {
              const key = `${classItem.id}|${slot.start.toISOString()}`;
              if (!eventMap.has(key)) {
                eventMap.set(key, {
                  id: `recurring_${classItem.id}_${slot.start.toISOString()}`,
                  title: classItem.name,
                  start: slot.start.toISOString(),
                  end: slot.end.toISOString(),
                  source: 'recurring',
                  classId: classItem.id,
                  className: classItem.name,
                  timezone: schedule.timezone ?? null,
                });
              }
            }
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      const events = Array.from(eventMap.values()).sort((a, b) =>
        a.start.localeCompare(b.start),
      );

      return {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        total: events.length,
        events,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error getting class calendar events:', error);
      throw new InternalServerErrorException('Failed to retrieve calendar events');
    }
  }

  /**
   * Get class by ID with full details
   */
  async getClassById(
    classId: string,
    userId: string,
  ): Promise<FullClassResponseDto> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
        include: {
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
              role: true,
            },
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
          sessions: {
            orderBy: { created_at: 'desc' },
            include: {
              host: {
                select: { id: true, full_name: true },
              },
            },
          },
          _count: {
            select: {
              members: true,
              teachers: true,
              sessions: true,
            },
          },
        },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      // Check if user has access to this class
      const hasAccess = (await this.isAdmin(userId)) || checkClassAccess(classData, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this class');
      }

      return toFullClassResponseDto(classData);
    } catch (error) {
      console.error('Error getting class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve class');
    }
  }

  /**
   * Get class members (students)
   */
  async getClassMembers(
    classId: string,
    userId: string,
  ): Promise<UserSummaryDto[]> {
    try {
      const hasAccess =
        (await this.isAdmin(userId)) ||
        (await checkClassAccessById(classId, userId, this.prisma));
      if (!hasAccess)
        throw new ForbiddenException('Access denied to this class');

      const members = await this.prisma.classMember.findMany({
        where: { class_id: classId },
        include: {
          student: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
              role: true,
            },
          },
        },
        orderBy: { joined_at: 'asc' },
      });

      return mapUsersToDto(members);
    } catch (error) {
      console.error('Error getting class members:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Failed to retrieve class members',
      );
    }
  }

  /**
   * Get class teachers
   */
  async getClassTeachers(
    classId: string,
    userId: string,
  ): Promise<UserSummaryDto[]> {
    try {
      const hasAccess =
        (await this.isAdmin(userId)) ||
        (await checkClassAccessById(classId, userId, this.prisma));
      if (!hasAccess)
        throw new ForbiddenException('Access denied to this class');

      const teachers = await this.prisma.classTeacher.findMany({
        where: { class_id: classId },
        include: {
          teacher: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar_url: true,
              role: true,
            },
          },
        },
      });

      return mapUsersToDto(teachers);
    } catch (error) {
      console.error('Error getting class teachers:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Failed to retrieve class teachers',
      );
    }
  }

  /**
   * Get class statistics
   */
  async getClassStatistics(
    classId: string,
    userId: string,
  ): Promise<ClassCountDto> {
    try {
      const hasAccess =
        (await this.isAdmin(userId)) ||
        (await checkClassAccessById(classId, userId, this.prisma));
      if (!hasAccess)
        throw new ForbiddenException('Access denied to this class');

      const [memberCount, teacherCount, sessionCount] =
        await Promise.all([
          this.prisma.classMember.count({ where: { class_id: classId } }),
          this.prisma.classTeacher.count({ where: { class_id: classId } }),
          this.prisma.session.count({ where: { class_id: classId } }),
        ]);

      return {
        members: memberCount,
        teachers: teacherCount,
        sessions: sessionCount,
      };
    } catch (error) {
      console.error('Error getting class statistics:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Failed to retrieve class statistics',
      );
    }
  }

  /**
   * Search classes by name/description the user can see (own, teaching, enrolled, or public classes)
   */
  async searchClasses(userId: string, q: string): Promise<ClassResponseDto[]> {
    try {
      const query = q?.trim();
      const whereClause: any = {
        OR: [
          { created_by: userId },
          { teachers: { some: { teacher_id: userId } } },
          { members: { some: { student_id: userId, status: 'active' } } },
          { is_group: true },
        ],
      };

      if (query) {
        whereClause.AND = [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
        ];
      }

      const results = await this.prisma.class.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          is_group: true,
          invite_code: true,
          created_by: true,
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              role: true,
            },
          },
          _count: { select: { members: true, teachers: true, sessions: true } },
        },
        orderBy: { updated_at: 'desc' },
      });

      return results;
    } catch (error) {
      console.error('Error searching classes:', error);
      throw new InternalServerErrorException('Failed to search classes');
    }
  }

  /**
   * Get public classes
   */
  async getPublicClasses(): Promise<ClassResponseDto[]> {
    try {
      const results = await this.prisma.class.findMany({
        where: { is_group: true },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          is_group: true,
          created_by: true,
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              role: true,
            },
          },
          _count: { select: { members: true, teachers: true, sessions: true } },
        },
        orderBy: { updated_at: 'desc' },
        take: 50,
      });
      return results;
    } catch (error) {
      console.error('Error getting public classes:', error);
      throw new InternalServerErrorException(
        'Failed to retrieve public classes',
      );
    }
  }

  /**
   * Admin: Get all classes
   */
  async getAllClasses(params: {
    page: number;
    pageSize: number;
    q?: string;
    sortBy?: 'name' | 'created_at' | 'updated_at';
    sortOrder?: 'asc' | 'desc';
    creatorId?: string;
  }): Promise<PaginatedClassResponseDto> {
    const {
      page,
      pageSize,
      q,
      sortBy = 'updated_at',
      sortOrder = 'desc',
      creatorId,
    } = params;
    try {
      const where: any = {};
      if (q && q.trim()) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (creatorId) where.created_by = creatorId;

      const [total, items] = await this.prisma.$transaction([
        this.prisma.class.count({ where }),
        this.prisma.class.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            creator: {
              select: { id: true, full_name: true, email: true, role: true },
            },
            _count: {
              select: { members: true, teachers: true, sessions: true },
            },
          },
        }),
      ]);

      const response: PaginatedClassResponseDto = {
        data: items,
        total,
        totalPages: Math.ceil(total / pageSize),
        page,
        pageSize,
      };

      return response;
    } catch (error) {
      console.error('Error getting all classes:', error);
      throw new InternalServerErrorException('Failed to retrieve classes');
    }
  }

  /**
   * Validate invite code
   */
  async validateInviteCode(
    code: string,
  ): Promise<{ valid: boolean; class: ClassResponseDto | null }> {
    try {
      const existing = await this.prisma.class.findUnique({
        where: { invite_code: code },
        select: {
          id: true,
          name: true,
          description: true,
          is_group: true,
          created_by: true,
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              members: true,
              teachers: true,
              sessions: true,
            },
          },
        },
      });
      return { valid: !!existing, class: existing || null };
    } catch (error) {
      console.error('Error validating invite code:', error);
      throw new InternalServerErrorException('Failed to validate invite code');
    }
  }
}
