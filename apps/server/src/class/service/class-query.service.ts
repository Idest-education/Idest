import {
  Injectable,
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

@Injectable()
export class ClassQueryService {
  constructor(private readonly prisma: PrismaService) {}

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
        take: 10,
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
