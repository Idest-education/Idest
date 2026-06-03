import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGameTemplateDto } from './dto/create-game-template.dto';
import { UpdateGameTemplateDto } from './dto/update-game-template.dto';

@Injectable()
export class GameTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.gameTemplate.findMany({
      where: { createdBy: userId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const template = await this.prisma.gameTemplate.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: true },
        },
      },
    });
    if (!template) throw new NotFoundException('Game template not found');
    if (template.createdBy !== userId) throw new ForbiddenException('Access denied');
    return template;
  }

  create(userId: string, dto: CreateGameTemplateDto) {
    return this.prisma.gameTemplate.create({
      data: {
        title: dto.title,
        description: dto.description,
        createdBy: userId,
        questions: {
          create: dto.questions.map((q) => ({
            text: q.text,
            type: q.type,
            order: q.order,
            timerSeconds: q.timerSeconds,
            correctAnswer: q.correctAnswer,
            options: q.options
              ? { create: q.options.map((o) => ({ label: o.label, text: o.text })) }
              : undefined,
          })),
        },
      },
      include: {
        questions: { include: { options: true } },
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateGameTemplateDto) {
    await this.findOne(userId, id);
    return this.prisma.gameTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        questions: dto.questions
          ? {
              deleteMany: {},
              create: dto.questions.map((q) => ({
                text: q.text,
                type: q.type,
                order: q.order,
                timerSeconds: q.timerSeconds,
                correctAnswer: q.correctAnswer,
                options: q.options
                  ? { create: q.options.map((o) => ({ label: o.label, text: o.text })) }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.gameTemplate.delete({ where: { id } });
  }
}
