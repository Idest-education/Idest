import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AchievementService } from './achievement.service';
import { PrismaService } from 'src/prisma/prisma.service';

const mockPrisma = {
  gameSession: { findUnique: jest.fn() },
  session: { findUnique: jest.fn() },
  gameParticipant: { findMany: jest.fn() },
  gameAnswer: { findMany: jest.fn() },
  gameClassStats: { findUnique: jest.fn() },
  gameMedal: { findMany: jest.fn() },
  gameMedalAward: { findMany: jest.fn(), create: jest.fn() },
};
const mockEventEmitter = { emit: jest.fn() };

describe('AchievementService', () => {
  let service: AchievementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    service = module.get<AchievementService>(AchievementService);
    jest.clearAllMocks();
  });

  describe('checkAndAward', () => {
    const baseSession = { id: 'gs1', sessionId: 'meet-1' };
    const baseMeetingSession = { id: 'meet-1', class_id: 'class-1' };
    const baseParticipants = [
      { id: 'p1', userId: 'u1', score: 900 },
    ];
    const baseAnswers = [
      { participantId: 'p1', isCorrect: true, responseTimeMs: 3000 },
      { participantId: 'p1', isCorrect: true, responseTimeMs: 2500 },
      { participantId: 'p1', isCorrect: true, responseTimeMs: 2800 },
    ];
    const baseStats = {
      classId: 'class-1', userId: 'u1',
      totalWins: 3, consecutiveWins: 3, maxConsecWins: 3,
      totalGames: 10, correctAnswers: 18, totalAnswers: 20,
      weeklyPoints: 5000, monthlyPoints: 20000,
    };

    beforeEach(() => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(baseSession);
      mockPrisma.session.findUnique.mockResolvedValue(baseMeetingSession);
      mockPrisma.gameParticipant.findMany.mockResolvedValue(baseParticipants);
      mockPrisma.gameAnswer.findMany.mockResolvedValue(baseAnswers);
      mockPrisma.gameClassStats.findUnique.mockResolvedValue(baseStats);
      mockPrisma.gameMedal.findMany.mockResolvedValue([
        { id: 'm1', key: 'WINS_3', category: 'WINNING', name: '3 Wins', description: '...', icon: '🏆' },
        { id: 'm2', key: 'GAMES_10', category: 'PARTICIPATION', name: '10 Games', description: '...', icon: '🎮' },
        { id: 'm3', key: 'CONSEC_WIN_3', category: 'STREAK', name: '3 in a Row', description: '...', icon: '🔥' },
      ]);
      mockPrisma.gameMedalAward.findMany.mockResolvedValue([]); // none yet awarded
      mockPrisma.gameMedalAward.create.mockResolvedValue({});
    });

    it('awards medals that qualify and have not been awarded yet', async () => {
      await service.checkAndAward('gs1');

      // WINS_3: totalWins=3 ≥ 3 → should award
      expect(mockPrisma.gameMedalAward.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', classId: 'class-1' }),
        }),
      );
    });

    it('does not re-award already earned medals', async () => {
      mockPrisma.gameMedalAward.findMany.mockResolvedValue([
        { medalId: 'm1', userId: 'u1', classId: 'class-1' }, // WINS_3 already awarded
        { medalId: 'm2', userId: 'u1', classId: 'class-1' }, // GAMES_10 already awarded
        { medalId: 'm3', userId: 'u1', classId: 'class-1' }, // CONSEC_WIN_3 already awarded
      ]);

      await service.checkAndAward('gs1');

      expect(mockPrisma.gameMedalAward.create).not.toHaveBeenCalled();
    });

    it('emits game.medal.earned for each new medal', async () => {
      await service.checkAndAward('gs1');

      const calls = mockEventEmitter.emit.mock.calls.filter((c) => c[0] === 'game.medal.earned');
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][1]).toMatchObject({
        userId: 'u1',
        classId: 'class-1',
        medal: expect.objectContaining({ key: expect.any(String) }),
      });
    });

    it('does not throw if DB error on award creation (swallows errors)', async () => {
      mockPrisma.gameMedalAward.create.mockRejectedValue(new Error('DB error'));
      await expect(service.checkAndAward('gs1')).resolves.not.toThrow();
    });
  });
});
