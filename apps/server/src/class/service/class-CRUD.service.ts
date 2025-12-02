import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { userPayload } from 'src/common/types/userPayload.interface';
import { CreateClassDto } from '../dto/create-class.dto';
import { UpdateClassDto } from '../dto/update-class.dto';
import {
  ClassResponseDto,
  FullClassResponseDto,
} from '../dto/class-response.dto';
import {
  checkClassManagementPermission,
  generateUniqueInviteCode,
  generateUniqueSlug,
  toFullClassResponseDto,
} from '../class.util';

@Injectable()
export class ClassCRUDService {
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
        dto.invite_code || (await generateUniqueInviteCode(this.prisma));
      const existingClass = await this.prisma.class.findUnique({
        where: { invite_code: inviteCode },
      });

      if (existingClass) {
        throw new ConflictException('Invite code already exists');
      }

      const slug = await generateUniqueSlug(dto.name, this.prisma);

      const newClass = await this.prisma.class.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          is_group: dto.is_group,
          invite_code: inviteCode,
          price: dto.price ?? null,
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
   * Regenerate invite code (creator or teacher)
   */
  async regenerateInviteCode(classId: string, userId: string): Promise<string> {
    try {
      const hasPermission = await checkClassManagementPermission(
        classId,
        userId,
        this.prisma,
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'Only class creators and teachers can regenerate invite code',
        );
      }

      const newCode = await generateUniqueInviteCode(this.prisma);

      const updated = await this.prisma.class.update({
        where: { id: classId },
        data: { invite_code: newCode },
        select: { id: true, invite_code: true },
      });

      return updated.invite_code;
    } catch (error) {
      console.error('Error regenerating invite code:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Failed to regenerate invite code',
      );
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
        this.prisma,
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
