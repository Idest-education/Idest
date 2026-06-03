import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GameTemplateService } from './game-template.service';
import { PrismaService } from 'src/prisma/prisma.service';

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
});
