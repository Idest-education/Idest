import { Test, TestingModule } from '@nestjs/testing';
import { ClassStatsService } from './class-stats.service';
import { PrismaService } from 'src/prisma/prisma.service';

const mockPrisma = {
  gameSession: { findUnique: jest.fn() },
  session: { findUnique: jest.fn() },
  gameParticipant: { findMany: jest.fn() },
  gameAnswer: { findMany: jest.fn() },
  gameClassStats: { upsert: jest.fn(), updateMany: jest.fn() },
  $executeRaw: jest.fn(),
};

describe('ClassStatsService', () => {
  let service: ClassStatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassStatsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClassStatsService>(ClassStatsService);
    jest.clearAllMocks();
  });

  describe('updateStats', () => {
    it('derives classId from Session.class_id and upserts stats for each participant', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs1',
        sessionId: 'meet-1',
      });
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'meet-1',
        class_id: 'class-1',
      });
      mockPrisma.gameParticipant.findMany.mockResolvedValue([
        { id: 'p1', userId: 'u1', score: 800 },
        { id: 'p2', userId: 'u2', score: 600 },
      ]);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([
        { participantId: 'p1', isCorrect: true, responseTimeMs: 3000 },
        { participantId: 'p1', isCorrect: false, responseTimeMs: 5000 },
        { participantId: 'p2', isCorrect: true, responseTimeMs: 2000 },
      ]);
      mockPrisma.gameClassStats.upsert.mockResolvedValue({});
      mockPrisma.$executeRaw.mockResolvedValue(1);

      await service.updateStats('gs1');

      expect(mockPrisma.gameClassStats.upsert).toHaveBeenCalledTimes(2);
      // First participant (winner: score 800 > score 600)
      expect(mockPrisma.gameClassStats.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classId_userId: { classId: 'class-1', userId: 'u1' } },
          create: expect.objectContaining({ classId: 'class-1', userId: 'u1', totalWins: 1 }),
          update: expect.objectContaining({ totalGames: { increment: 1 }, totalWins: { increment: 1 } }),
        }),
      );
      // Second participant (not winner)
      expect(mockPrisma.gameClassStats.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classId_userId: { classId: 'class-1', userId: 'u2' } },
          update: expect.objectContaining({ totalGames: { increment: 1 } }),
        }),
      );
    });

    it('throws NotFoundException if gameSession not found', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);
      await expect(service.updateStats('bad-id')).rejects.toThrow();
    });
  });

  describe('resetWeeklyPoints', () => {
    it('zeros out weeklyPoints for all records', async () => {
      mockPrisma.gameClassStats.updateMany.mockResolvedValue({ count: 5 });
      await service.resetWeeklyPoints();
      expect(mockPrisma.gameClassStats.updateMany).toHaveBeenCalledWith({
        data: { weeklyPoints: 0, weeklyResetAt: expect.any(Date) },
      });
    });
  });

  describe('resetMonthlyPoints', () => {
    it('zeros out monthlyPoints for all records', async () => {
      mockPrisma.gameClassStats.updateMany.mockResolvedValue({ count: 5 });
      await service.resetMonthlyPoints();
      expect(mockPrisma.gameClassStats.updateMany).toHaveBeenCalledWith({
        data: { monthlyPoints: 0, monthlyResetAt: expect.any(Date) },
      });
    });
  });
});
