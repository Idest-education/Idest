import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddClassMemberDto, AddClassTeacherDto } from '../dto/class-member.dto';
import { BulkStudentIdsDto } from '../dto/bulk-members.dto';
import {
  FullClassResponseDto,
  UserSummaryDto,
} from '../dto/class-response.dto';
import {
  checkClassManagementPermission,
  toFullClassResponseDto,
} from '../class.util';

@Injectable()
export class ClassMembershipService {
  constructor(private readonly prisma: PrismaService) {}

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
  async joinClass(
    userId: string,
    inviteCode: string,
  ): Promise<FullClassResponseDto> {
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

      return true;
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

      return created.map((c) => c.student);
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
}
