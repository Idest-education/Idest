import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GameTemplateService } from './game-template.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { QuestionTypeDto } from './dto/create-game-template.dto';

const mockPrisma = {
  gameTemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('GameTemplateService', () => {
  let service: GameTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameTemplateService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<GameTemplateService>(GameTemplateService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns only templates owned by the caller', async () => {
      const templates = [{ id: '1', createdBy: 'user-1', title: 'Quiz', questions: [] }];
      mockPrisma.gameTemplate.findMany.mockResolvedValue(templates);
      const result = await service.findAll('user-1');
      expect(mockPrisma.gameTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdBy: 'user-1' } }),
      );
      expect(result).toEqual(templates);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when template not found', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue(null);
      await expect(service.findOne('user-1', 'missing-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller does not own the template', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({
        id: '1',
        createdBy: 'other-user',
        questions: [],
      });
      await expect(service.findOne('user-1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('returns template when caller owns it', async () => {
      const template = { id: '1', createdBy: 'user-1', questions: [] };
      mockPrisma.gameTemplate.findUnique.mockResolvedValue(template);
      const result = await service.findOne('user-1', '1');
      expect(result).toEqual(template);
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when caller does not own the template', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({
        id: '1',
        createdBy: 'other-user',
        questions: [],
      });
      await expect(service.remove('user-1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes the template when caller owns it', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({ id: '1', createdBy: 'user-1', questions: [] });
      mockPrisma.gameTemplate.delete.mockResolvedValue({ id: '1' });
      await service.remove('user-1', '1');
      expect(mockPrisma.gameTemplate.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('create', () => {
    it('creates a template with nested questions and options', async () => {
      const created = {
        id: '1',
        title: 'Quiz',
        createdBy: 'user-1',
        questions: [{ id: 'q1', text: 'Q1', options: [] }],
      };
      mockPrisma.gameTemplate.create.mockResolvedValue(created);

      const dto = {
        title: 'Quiz',
        questions: [
          {
            text: 'Q1',
            type: QuestionTypeDto.MULTIPLE_CHOICE,
            order: 1,
            timerSeconds: 20,
            correctAnswer: 'A',
            options: [{ label: 'A', text: 'Yes' }, { label: 'B', text: 'No' }],
          },
        ],
      };
      const result = await service.create('user-1', dto);
      expect(mockPrisma.gameTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdBy: 'user-1', title: 'Quiz' }),
        }),
      );
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('throws ForbiddenException when caller does not own the template', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({
        id: '1',
        createdBy: 'other-user',
        questions: [],
      });
      await expect(service.update('user-1', '1', { title: 'New' })).rejects.toThrow(ForbiddenException);
    });

    it('updates metadata without replacing questions when questions not provided', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({ id: '1', createdBy: 'user-1', questions: [] });
      const updated = { id: '1', title: 'New Title', questions: [] };
      mockPrisma.gameTemplate.update.mockResolvedValue(updated);

      const result = await service.update('user-1', '1', { title: 'New Title' });
      expect(mockPrisma.gameTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({ title: 'New Title' }),
        }),
      );
      expect(result).toEqual(updated);
    });
  });
});
