import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { userPayload } from 'src/common/types/userPayload.interface';
import { ResponseDto } from 'src/common/dto/response.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AddClassMemberDto, AddClassTeacherDto } from './dto/class-member.dto';
import { Role } from 'src/common/enum/role.enum';
import { BulkStudentIdsDto } from './dto/bulk-members.dto';
import { ClassCountDto, ClassResponseDto, FullClassResponseDto, PaginatedClassResponseDto, UserClassesResponseDto, UserSummaryDto } from './dto/class-response.dto';
import { checkClassAccess, checkClassAccessById, checkClassManagementPermission, generateUniqueInviteCode, generateUniqueSlug, mapUsersToDto, toFullClassResponseDto } from './class.util';
import { SessionResponseDto } from 'src/session/dto/session-response.dto';

@Injectable()
export class ClassService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new class
   */
  async createClass(
    user: userPayload,
    dto: CreateClassDto,
  ): Promise<ClassResponseDto> {
    try {
      // Unique Class Name
      const existingByName = await this.prisma.class.findFirst({
        where: { name: dto.name },
        select: { id: true },
      });
      if (existingByName) {
        throw new ConflictException('Class name already exists');
      }

      const inviteCode =
        dto.invite_code || (await generateUniqueInviteCode());
      const existingClass = await this.prisma.class.findUnique({
        where: { invite_code: inviteCode },
      });

      if (existingClass) {
        throw new ConflictException('Invite code already exists');
      }

      const slug = await generateUniqueSlug(dto.name);

      const newClass = await this.prisma.class.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          is_group: dto.is_group,
          invite_code: inviteCode,
          schedule: dto.schedule || {},
          created_by: user.id,
        },
        include: {
          creator: {
            select: {
              id: true,
              full_name: true,
              email: true,
              role: true,
              avatar_url: true,
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

      return newClass;
    } catch (error) {
      console.error('Error creating class:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create class');
    }
  }

  /**
   * Get class by slug with full details
   */
  async getClassBySlug(slug: string, userId: string): Promise<FullClassResponseDto> {
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

      const hasAccess = checkClassAccess(classData, userId);
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
            select: { id: true, full_name: true, email: true, role: true },
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
            select: { id: true, full_name: true, email: true, role: true },
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
            select: { id: true, full_name: true, email: true, role: true },
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
  async getClassById(classId: string, userId: string): Promise<FullClassResponseDto> {
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
      const hasAccess = checkClassAccess(classData, userId);
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
   * Update class details
   */
  async updateClass(
    classId: string,
    userId: string,
    dto: UpdateClassDto,
  ): Promise<FullClassResponseDto> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      const updatedClass = await this.prisma.class.update({
        where: { id: classId },
        data: dto,
        include: {
          creator: {
            select: { id: true, full_name: true, email: true, role: true },
          },
          _count: {
            select: { members: true, teachers: true, sessions: true },
          },
        },
      });

      return toFullClassResponseDto(updatedClass);
    } catch (error) {
      console.error('Error updating class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update class');
    }
  }

  /**
   * Add a student to the class
   */
  async addStudent(
    classId: string,
    userId: string,
    dto: AddClassMemberDto,
  ): Promise<FullClassResponseDto> {
    try {
      // Check if user is creator or teacher
      const hasPermission = await checkClassManagementPermission(
        classId,
        userId,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can add students',
        );
      }

      const existingMember = await this.prisma.classMember.findFirst({
        where: {
          class_id: classId,
          student_id: dto.student_id,
        },
      });

      if (existingMember) {
        throw new ConflictException('Student is already in this class');
      }

      const classMember = await this.prisma.classMember.create({
        data: {
          class_id: classId,
          student_id: dto.student_id,
          status: dto.status || 'active',
        },
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
      });

      return toFullClassResponseDto(classMember);
    } catch (error) {
      console.error('Error adding student:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add student');
    }
  }

  /**
   * Add a teacher to the class
   */
  async addTeacher(
    classId: string,
    userId: string,
    dto: AddClassTeacherDto,
  ): Promise<FullClassResponseDto> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      if (classData.created_by !== userId) {
        throw new ForbiddenException('Only class creator can add teachers');
      }

      const existingTeacher = await this.prisma.classTeacher.findFirst({
        where: {
          class_id: classId,
          teacher_id: dto.teacher_id,
        },
      });

      if (existingTeacher) {
        throw new ConflictException('Teacher is already in this class');
      }

      const classTeacher = await this.prisma.classTeacher.create({
        data: {
          class_id: classId,
          teacher_id: dto.teacher_id,
          role: dto.role || 'teacher',
        },
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
      });

      return toFullClassResponseDto(classTeacher);
    } catch (error) {
      console.error('Error adding teacher:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add teacher');
    }
  }

  /**
   * Remove a teacher from the class (only creator)
   */
  async removeTeacher(
    classId: string,
    userId: string,
    teacherId: string,
  ): Promise<FullClassResponseDto> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      const existingTeacher = await this.prisma.classTeacher.findFirst({
        where: { class_id: classId, teacher_id: teacherId },
      });

      if (!existingTeacher) {
        throw new NotFoundException('Teacher not found in this class');
      }

      await this.prisma.classTeacher.delete({
        where: { id: existingTeacher.id },
      });

      return toFullClassResponseDto(classData);
    } catch (error) {
      console.error('Error removing teacher:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to remove teacher');
    }
  }

  /**
   * Join class by invite code
   */
  async joinClass(userId: string, inviteCode: string): Promise<FullClassResponseDto> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { invite_code: inviteCode },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      const existingMember = await this.prisma.classMember.findFirst({
        where: {
          class_id: classData.id,
          student_id: userId,
        },
      });

      if (existingMember) {
        throw new ConflictException('You are already a member of this class');
      }

      const classMember = await this.prisma.classMember.create({
        data: {
          class_id: classData.id,
          student_id: userId,
          status: 'active',
        },
        include: {
          class: {
            select: { id: true, name: true, description: true },
          },
          student: {
            select: { id: true, full_name: true, email: true },
          },
        },
      });

      return toFullClassResponseDto(classMember);
    } catch (error) {
      console.error('Error joining class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to join class');
    }
  }

  /**
   * Leave class (student or teacher)
   */
  async leaveClass(classId: string, userId: string): Promise<boolean> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData) throw new NotFoundException('Class not found');

      if (classData.created_by === userId) {
        throw new ForbiddenException('Class creator cannot leave the class');
      }

      const member = await this.prisma.classMember.findFirst({
        where: { class_id: classId, student_id: userId },
      });
      if (member) {
        await this.prisma.classMember.delete({ where: { id: member.id } });
        return true;
      }

      const teacher = await this.prisma.classTeacher.findFirst({
        where: { class_id: classId, teacher_id: userId },
      });
      if (teacher) {
        await this.prisma.classTeacher.delete({ where: { id: teacher.id } });
        return true;
      }

      throw new NotFoundException('You are not a member of this class');
    } catch (error) {
      console.error('Error leaving class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to leave class');
    }
  }

  /**
   * Remove student from class
   */
  async removeStudent(
    classId: string,
    userId: string,
    studentId: string,
  ): Promise<boolean> {
    try {
      const hasPermission = await checkClassManagementPermission(
        classId,
        userId,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can remove students',
        );
      }

      const classMember = await this.prisma.classMember.findFirst({
        where: {
          class_id: classId,
          student_id: studentId,
        },
      });

      if (!classMember) {
        throw new NotFoundException('Student not found in this class');
      }

      await this.prisma.classMember.delete({
        where: { id: classMember.id },
      });

      return true
    } catch (error) {
      console.error('Error removing student:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to remove student');
    }
  }

  /**
   * Get class members (students)
   */
  async getClassMembers(classId: string, userId: string): Promise<UserSummaryDto[]> {
    try {
      const hasAccess = await checkClassAccessById(classId, userId);
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
      throw new InternalServerErrorException('Failed to retrieve class members');
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
      const hasAccess = await checkClassAccessById(classId, userId);
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
      throw new InternalServerErrorException('Failed to retrieve class teachers');
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
      const hasAccess = await checkClassAccessById(classId, userId);
      if (!hasAccess)
        throw new ForbiddenException('Access denied to this class');

      const [memberCount, teacherCount, sessionCount, assignmentCount] =
        await Promise.all([
          this.prisma.classMember.count({ where: { class_id: classId } }),
          this.prisma.classTeacher.count({ where: { class_id: classId } }),
          this.prisma.session.count({ where: { class_id: classId } }),
          this.prisma.assignment.count({ where: { class_id: classId } }),
        ]);

      return {
        members: memberCount,
        teachers: teacherCount,
        sessions: sessionCount,
      };
    } catch (error) {
      console.error('Error getting class statistics:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to retrieve class statistics');
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
      throw new InternalServerErrorException('Failed to retrieve public classes');
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
      console.log(
        'response: ',
        ResponseDto.ok({
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          items,
        }),
      );

      console.log('items: ', items);
      const response: PaginatedClassResponseDto = {
        data: items,
        total,
        totalPages: Math.ceil(total / pageSize),
        page,
        pageSize,
      };

      return response
    } catch (error) {
      console.error('Error getting all classes:', error);
      throw new InternalServerErrorException('Failed to retrieve classes');
    }
  }

  /**
   * Regenerate invite code (creator or teacher)
   */
  async regenerateInviteCode(
    classId: string,
    userId: string,
  ): Promise<string> {
    try {
      const hasPermission = await checkClassManagementPermission(
        classId,
        userId,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can regenerate invite code',
        );
      }

      const newCode = await generateUniqueInviteCode();

      const updated = await this.prisma.class.update({
        where: { id: classId },
        data: { invite_code: newCode },
        select: { id: true, invite_code: true },
      });

      return updated.invite_code;
    } catch (error) {
      console.error('Error regenerating invite code:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to regenerate invite code');
    }
  }

  /**
   * Validate invite code
   */
  async validateInviteCode(code: string): Promise<{ valid: boolean, class: ClassResponseDto | null }> {
    try {
      const existing = await this.prisma.class.findUnique({
        where: { invite_code: code },
        select: { id: true, name: true, description: true, is_group: true, created_by: true, creator: { select: { id: true, full_name: true, email: true, role: true } }, _count: { select: { members: true, teachers: true, sessions: true } } },
      });
      return { valid: !!existing, class: existing || null };
    } catch (error) {
      console.error('Error validating invite code:', error);
      throw new InternalServerErrorException('Failed to validate invite code');
    }
  }

  /**
   * Update class settings (creator or teacher)
   */
  async updateClassSettings(
    classId: string,
    userId: string,
    dto: UpdateClassDto,
  ): Promise<ClassResponseDto> {
    try {
      const hasPermission = await checkClassManagementPermission(
        classId,
        userId,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can update settings',
        );
      }

      const updated = await this.prisma.class.update({
        where: { id: classId },
        data: dto,
        include: {
          creator: {
            select: { id: true, full_name: true, email: true, role: true },
          },
          _count: { select: { members: true, teachers: true, sessions: true } },
        },
      });

      return updated;
    } catch (error) {
      console.error('Error updating class settings:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to update class settings');
    }
  }

  /**
   * Bulk add students
   */
  async bulkAddStudents(
    classId: string,
    userId: string,
    dto: BulkStudentIdsDto,
  ): Promise<UserSummaryDto[]> {
    try {
      const hasPermission = await checkClassManagementPermission(
        classId,
        userId,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can add students',
        );
      }

      const uniqueIds = Array.from(new Set(dto.student_ids));
      if (uniqueIds.length === 0) {
        return [];
      }

      // Filter
      const existingMembers = await this.prisma.classMember.findMany({
        where: { class_id: classId, student_id: { in: uniqueIds } },
        select: { student_id: true },
      });
      const existingSet = new Set(existingMembers.map((m) => m.student_id));
      const toCreate = uniqueIds.filter((id) => !existingSet.has(id));

      if (toCreate.length === 0) {
        return [];
      }

      const created = await this.prisma.$transaction(
        toCreate.map((studentId) =>
          this.prisma.classMember.create({
            data: {
              class_id: classId,
              student_id: studentId,
              status: 'active',
            },
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
          }),
        ),
      );

      return created.map(c => c.student);
    } catch (error) {
      console.error('Error bulk adding students:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to bulk add students');
    }
  }

  /**
   * Bulk remove students
   */
  async bulkRemoveStudents(
    classId: string,
    userId: string,
    dto: BulkStudentIdsDto,
  ): Promise<{ count: number }> {
    try {
      const hasPermission = await checkClassManagementPermission(
        classId,
        userId,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can remove students',
        );
      }

      const uniqueIds = Array.from(new Set(dto.student_ids));
      if (uniqueIds.length === 0) {
        return { count: 0 };
      }

      const deleted = await this.prisma.classMember.deleteMany({
        where: { class_id: classId, student_id: { in: uniqueIds } },
      });

      return { count: deleted.count };
    } catch (error) {
      console.error('Error bulk removing students:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to bulk remove students');
    }
  }

  /**
   * Delete class (only creator)
   */
  async deleteClass(classId: string, userId: string): Promise<void> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      if (classData.created_by !== userId) {
        throw new ForbiddenException('Only class creator can delete the class');
      }

      await this.prisma.class.delete({
        where: { id: classId },
      });

      return;
    } catch (error) {
      console.error('Error deleting class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete class');
    }
  }


}
