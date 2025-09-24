import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { userPayload } from 'src/common/types/userPayload.interface';
import { CreateAssignmentDto } from 'src/assignment/dto/create-assignment.dto';
import { UpdateAssignmentDto } from 'src/assignment/dto/update-assignment.dto';
import { AssignmentResponseDto } from 'src/assignment/dto/assignment-response.dto';
import { generateUniqueAssignmentSlug } from 'src/assignment/assignment.util';
import { checkClassManagementPermission } from 'src/class/class.util';

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssignment(
    user: userPayload,
    dto: CreateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    if (dto.class_id) {
      const canManage = await checkClassManagementPermission(
        dto.class_id,
        user.id,
        this.prisma,
      );
      if (!canManage) throw new ForbiddenException('No permission for class');
    }

    const slug = await generateUniqueAssignmentSlug(dto.title, this.prisma);

    const created = await this.prisma.assignment.create({
      data: {
        created_by: user.id,
        class_id: dto.class_id ?? null,
        skill: dto.skill,
        title: dto.title,
        slug,
        description: dto.description,
        is_public: dto.is_public,
      },
    });

    return this.toResponseDto(created);
  }

  async updateAssignment(
    id: string,
    user: userPayload,
    dto: UpdateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    const existing = await this.prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assignment not found');
    if (existing.created_by !== user.id) {
      throw new ForbiddenException('Only creator can update assignment');
    }

    let newSlug: string | undefined;
    if (dto.title && dto.title !== existing.title) {
      newSlug = await generateUniqueAssignmentSlug(dto.title, this.prisma);
    }

    const updated = await this.prisma.assignment.update({
      where: { id },
      data: {
        class_id: dto.class_id !== undefined ? dto.class_id : undefined,
        skill: dto.skill !== undefined ? dto.skill : undefined,
        title: dto.title !== undefined ? dto.title : undefined,
        slug: newSlug,
        description:
          dto.description !== undefined ? dto.description : undefined,
        is_public: dto.is_public !== undefined ? dto.is_public : undefined,
      },
    });

    return this.toResponseDto(updated);
  }

  async deleteAssignment(id: string, user: userPayload): Promise<void> {
    const existing = await this.prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assignment not found');
    if (existing.created_by !== user.id) {
      throw new ForbiddenException('Only creator can delete assignment');
    }
    await this.prisma.assignment.delete({ where: { id } });
  }

  async getAssignments(params: {
    user?: userPayload;
    class_id?: string;
    creator_id?: string;
    is_public?: boolean;
    q?: string;
  }): Promise<AssignmentResponseDto[]> {
    const { user, class_id, creator_id, is_public, q } = params;

    if (class_id && user) {
      const hasAccess = await checkClassManagementPermission(
        class_id,
        user.id,
        this.prisma,
      );
      if (!hasAccess) throw new ForbiddenException('No access to class');
    }

    const assignments = await this.prisma.assignment.findMany({
      where: {
        class_id: class_id ?? undefined,
        created_by: creator_id ?? undefined,
        is_public: is_public ?? undefined,
        OR: q
          ? [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { created_at: 'desc' },
    });

    return assignments.map((a) => this.toResponseDto(a));
  }

  async getAssignmentById(
    id: string,
    user?: userPayload,
  ): Promise<AssignmentResponseDto> {
    const a = await this.prisma.assignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Assignment not found');
    if (!a.is_public) {
      if (!user) throw new ForbiddenException('Authentication required');
      if (a.created_by !== user.id) {
        const canAccess = a.class_id
          ? await checkClassManagementPermission(
              a.class_id,
              user.id,
              this.prisma,
            )
          : false;
        if (!canAccess) throw new ForbiddenException('No access');
      }
    }
    return this.toResponseDto(a);
  }

  async getAssignmentBySlug(
    slug: string,
    user?: userPayload,
  ): Promise<AssignmentResponseDto> {
    const a = await this.prisma.assignment.findUnique({ where: { slug } });
    if (!a) throw new NotFoundException('Assignment not found');
    if (!a.is_public) {
      if (!user) throw new ForbiddenException('Authentication required');
      if (a.created_by !== user.id) {
        const canAccess = a.class_id
          ? await checkClassManagementPermission(
              a.class_id,
              user.id,
              this.prisma,
            )
          : false;
        if (!canAccess) throw new ForbiddenException('No access');
      }
    }
    return this.toResponseDto(a);
  }

  private toResponseDto(a: any): AssignmentResponseDto {
    return {
      id: a.id,
      created_by: a.created_by,
      class_id: a.class_id ?? '',
      skill: a.skill,
      title: a.title,
      slug: a.slug,
      description: a.description,
      is_public: a.is_public,
      created_at: a.created_at,
    };
  }
}
