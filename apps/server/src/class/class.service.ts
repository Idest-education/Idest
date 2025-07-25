import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { userPayload } from 'src/common/types/userPayload.interface';
import { ResponseDto } from 'src/common/dto/response.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AddClassMemberDto, AddClassTeacherDto } from './dto/class-member.dto';
import { Role } from 'src/common/enum/role.enum';

@Injectable()
export class ClassService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new class
   */
  async createClass(
    user: userPayload,
    dto: CreateClassDto,
  ): Promise<ResponseDto> {
    try {
      // Generate unique invite code if not provided
      const inviteCode = dto.invite_code || this.generateInviteCode();

      // Check if invite code is unique
      const existingClass = await this.prisma.class.findUnique({
        where: { invite_code: inviteCode },
      });

      if (existingClass) {
        throw new ConflictException('Invite code already exists');
      }

      const newClass = await this.prisma.class.create({
        data: {
          name: dto.name,
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

      return ResponseDto.ok(newClass, 'Class created successfully');
    } catch (error) {
      console.error('Error creating class:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Failed to create class');
    }
  }

  /**
   * Get all classes for a user (as creator, teacher, or student)
   */
  async getUserClasses(userId: string): Promise<ResponseDto> {
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
        created: createdClasses,
        teaching: teachingClasses,
        enrolled: studentClasses,
      };

      return ResponseDto.ok(classes, 'Classes retrieved successfully');
    } catch (error) {
      console.error('Error getting user classes:', error);
      throw new Error('Failed to retrieve classes');
    }
  }

  /**
   * Get class by ID with full details
   */
  async getClassById(classId: string, userId: string): Promise<ResponseDto> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
        include: {
          creator: {
            select: { id: true, full_name: true, email: true, role: true },
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
        },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      // Check if user has access to this class
      const hasAccess = this.checkClassAccess(classData, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this class');
      }

      return ResponseDto.ok(classData, 'Class details retrieved successfully');
    } catch (error) {
      console.error('Error getting class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to retrieve class');
    }
  }

  /**
   * Update class details
   */
  async updateClass(
    classId: string,
    userId: string,
    dto: UpdateClassDto,
  ): Promise<ResponseDto> {
    try {
      // Check if user is the creator
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      if (classData.created_by !== userId) {
        throw new ForbiddenException(
          'Only class creator can update class details',
        );
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

      return ResponseDto.ok(updatedClass, 'Class updated successfully');
    } catch (error) {
      console.error('Error updating class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to update class');
    }
  }

  /**
   * Add a student to the class
   */
  async addStudent(
    classId: string,
    userId: string,
    dto: AddClassMemberDto,
  ): Promise<ResponseDto> {
    try {
      // Check if user is creator or teacher
      const hasPermission = await this.checkClassManagementPermission(
        classId,
        userId,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can add students',
        );
      }

      // Check if student already exists
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

      return ResponseDto.ok(classMember, 'Student added successfully');
    } catch (error) {
      console.error('Error adding student:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new Error('Failed to add student');
    }
  }

  /**
   * Add a teacher to the class
   */
  async addTeacher(
    classId: string,
    userId: string,
    dto: AddClassTeacherDto,
  ): Promise<ResponseDto> {
    try {
      // Only class creator can add teachers
      const classData = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData) {
        throw new NotFoundException('Class not found');
      }

      if (classData.created_by !== userId) {
        throw new ForbiddenException('Only class creator can add teachers');
      }

      // Check if teacher already exists
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

      return ResponseDto.ok(classTeacher, 'Teacher added successfully');
    } catch (error) {
      console.error('Error adding teacher:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new Error('Failed to add teacher');
    }
  }

  /**
   * Join class by invite code
   */
  async joinClass(userId: string, inviteCode: string): Promise<ResponseDto> {
    try {
      const classData = await this.prisma.class.findUnique({
        where: { invite_code: inviteCode },
      });

      if (!classData) {
        throw new NotFoundException('Invalid invite code');
      }

      // Check if user is already in the class
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

      return ResponseDto.ok(classMember, 'Successfully joined the class');
    } catch (error) {
      console.error('Error joining class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new Error('Failed to join class');
    }
  }

  /**
   * Remove student from class
   */
  async removeStudent(
    classId: string,
    userId: string,
    studentId: string,
  ): Promise<ResponseDto> {
    try {
      const hasPermission = await this.checkClassManagementPermission(
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

      return ResponseDto.ok(null, 'Student removed successfully');
    } catch (error) {
      console.error('Error removing student:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to remove student');
    }
  }

  /**
   * Delete class (only creator)
   */
  async deleteClass(classId: string, userId: string): Promise<ResponseDto> {
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

      return ResponseDto.ok(null, 'Class deleted successfully');
    } catch (error) {
      console.error('Error deleting class:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error('Failed to delete class');
    }
  }

  /**
   * Helper: Generate unique invite code
   */
  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  /**
   * Helper: Check if user has access to class
   */
  private checkClassAccess(classData: any, userId: string): boolean {
    // Creator
    if (classData.created_by === userId) return true;

    // Teacher
    if (classData.teachers.some((t: any) => t.teacher_id === userId))
      return true;

    // Active student
    if (
      classData.members.some(
        (m: any) => m.student_id === userId && m.status === 'active',
      )
    )
      return true;

    return false;
  }

  /**
   * Helper: Check if user can manage class (creator or teacher)
   */
  private async checkClassManagementPermission(
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

    // Creator
    if (classData.created_by === userId) return true;

    // Teacher
    if (classData.teachers.some((t) => t.teacher_id === userId)) return true;

    return false;
  }
}
