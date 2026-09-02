import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameSessionService } from './game-session.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassStatsService } from './class-stats.service';
import { AchievementService } from './achievement.service';

const mockPrisma = {
  gameSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  gameTemplate: { findUnique: jest.fn() },
  gameParticipant: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  gameAnswer: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  user: { findMany: jest.fn() },
};
const mockEventEmitter = { emit: jest.fn() };
const mockClassStatsService = { updateStats: jest.fn().mockResolvedValue(undefined) };
const mockAchievementService = { checkAndAward: jest.fn().mockResolvedValue(undefined) };

describe('GameSessionService', () => {
  let service: GameSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameSessionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ClassStatsService, useValue: mockClassStatsService },
        { provide: AchievementService, useValue: mockAchievementService },
      ],
    }).compile();
    service = module.get<GameSessionService>(GameSessionService);
    jest.clearAllMocks();
  });

  describe('computeScore', () => {
    it('returns 1000 for an instant correct answer', () => {
      expect(service.computeScore(0, 20, true)).toBe(1000);
    });

    it('returns 500 for a correct answer submitted at the last millisecond', () => {
      expect(service.computeScore(20000, 20, true)).toBe(500);
    });

    it('returns 750 for a correct answer at half time', () => {
      expect(service.computeScore(10000, 20, true)).toBe(750);
    });

    it('returns 0 for a wrong answer regardless of speed', () => {
      expect(service.computeScore(0, 20, false)).toBe(0);
      expect(service.computeScore(5000, 20, false)).toBe(0);
    });

    it('clamps to 500 minimum for correct answers even if slightly over timer', () => {
      expect(service.computeScore(25000, 20, true)).toBe(500);
    });
  });

  describe('checkAnswer', () => {
    it('exact match returns true for MULTIPLE_CHOICE', () => {
      expect(service.checkAnswer('MULTIPLE_CHOICE', 'B', 'B')).toBe(true);
    });

    it('wrong option returns false for MULTIPLE_CHOICE', () => {
      expect(service.checkAnswer('MULTIPLE_CHOICE', 'B', 'C')).toBe(false);
    });

    it('case-insensitive exact match for FILL_BLANK', () => {
      expect(service.checkAnswer('FILL_BLANK', 'Joyful', 'joyful')).toBe(true);
    });

    it('1 typo accepted for 6-char word (tolerance = 1)', () => {
      expect(service.checkAnswer('FILL_BLANK', 'joyful', 'joyfull')).toBe(true);
    });

    it('2 typos rejected for 6-char word (tolerance = 1)', () => {
      expect(service.checkAnswer('FILL_BLANK', 'joyful', 'joyfully')).toBe(false);
    });

    it('completely wrong answer rejected', () => {
      expect(service.checkAnswer('FILL_BLANK', 'joyful', 'happy')).toBe(false);
    });

    it('leading/trailing whitespace is trimmed before matching', () => {
      expect(service.checkAnswer('FILL_BLANK', 'joyful', '  joyful  ')).toBe(true);
    });
  });

  describe('submitAnswer', () => {
    const baseSession = {
      id: 'session-1',
      status: 'IN_PROGRESS',
      currentQuestionIndex: 0,
      template: {
        questions: [
          { id: 'q1', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 20, order: 1, options: [] },
        ],
      },
    };

    it('returns isCorrect=true and points > 0 for a correct answer', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(baseSession);
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p1' });
      mockPrisma.gameAnswer.findUnique.mockResolvedValue(null);
      mockPrisma.gameAnswer.create.mockResolvedValue({});
      mockPrisma.gameParticipant.update.mockResolvedValue({});

      const result = await service.submitAnswer('session-1', 'user-1', 'A');

      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
      expect(mockPrisma.gameAnswer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isCorrect: true }) }),
      );
    });

    it('returns isCorrect=false and 0 points for a wrong answer', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(baseSession);
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p1' });
      mockPrisma.gameAnswer.findUnique.mockResolvedValue(null);
      mockPrisma.gameAnswer.create.mockResolvedValue({});
      mockPrisma.gameParticipant.update.mockResolvedValue({});

      const result = await service.submitAnswer('session-1', 'user-1', 'B');

      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });

    it('throws NotFoundException if session not found', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);

      await expect(service.submitAnswer('bad-id', 'user-1', 'A')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if session is not IN_PROGRESS', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({ ...baseSession, status: 'ENDED' });

      await expect(service.submitAnswer('session-1', 'user-1', 'A')).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on duplicate submission', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(baseSession);
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p1' });
      mockPrisma.gameAnswer.findUnique.mockResolvedValue({ id: 'existing-answer' });

      await expect(service.submitAnswer('session-1', 'user-1', 'A')).rejects.toThrow(ConflictException);
    });
  });

  describe('checkAnswer — MULTI_CHOICE', () => {
    it('returns true when submitted set exactly matches correct set (order-independent)', () => {
      expect(service.checkAnswer('MULTI_CHOICE', 'B,C', 'C,B')).toBe(true);
      expect(service.checkAnswer('MULTI_CHOICE', 'A,C', 'A,C')).toBe(true);
    });

    it('returns false when submitted set is a subset of correct set', () => {
      expect(service.checkAnswer('MULTI_CHOICE', 'B,C', 'B')).toBe(false);
    });

    it('returns false when submitted set is a superset', () => {
      expect(service.checkAnswer('MULTI_CHOICE', 'B,C', 'A,B,C')).toBe(false);
    });

    it('returns false when submitted set is completely wrong', () => {
      expect(service.checkAnswer('MULTI_CHOICE', 'B,C', 'A,D')).toBe(false);
    });
  });

  describe('checkAnswer — WORD_CLOUD', () => {
    it('always returns true for any non-empty word', () => {
      expect(service.checkAnswer('WORD_CLOUD', '', 'happy')).toBe(true);
      expect(service.checkAnswer('WORD_CLOUD', '', 'anything')).toBe(true);
    });
  });

  describe('checkMatchLR', () => {
    const pairs = [
      { leftLabel: 'A', rightText: 'Joyful' },
      { leftLabel: 'B', rightText: 'Sad' },
      { leftLabel: 'C', rightText: 'Angry' },
    ];

    it('returns ratio 1.0 when all pairs are correct', () => {
      const submitted = [
        { left: 'A', right: 'Joyful' },
        { left: 'B', right: 'Sad' },
        { left: 'C', right: 'Angry' },
      ];
      expect(service.checkMatchLR(pairs, submitted)).toBe(1);
    });

    it('returns ratio 0.667 when 2 of 3 pairs correct', () => {
      const submitted = [
        { left: 'A', right: 'Joyful' },
        { left: 'B', right: 'Sad' },
        { left: 'C', right: 'Wrong' },
      ];
      expect(service.checkMatchLR(pairs, submitted)).toBeCloseTo(2 / 3);
    });

    it('returns 0 when all pairs are wrong', () => {
      const submitted = [
        { left: 'A', right: 'Wrong' },
        { left: 'B', right: 'Wrong' },
        { left: 'C', right: 'Wrong' },
      ];
      expect(service.checkMatchLR(pairs, submitted)).toBe(0);
    });
  });

  describe('computeMatchLRScore', () => {
    it('returns full speed-bonus points when ratio is 1 and instant response', () => {
      expect(service.computeMatchLRScore(1, 0, 20)).toBe(1000);
    });

    it('returns 0 when ratio is 0', () => {
      expect(service.computeMatchLRScore(0, 5000, 20)).toBe(0);
    });

    it('returns proportional points for partial ratio', () => {
      // ratio=0.5, responseTime=0 → speedBonus=1000 → 0.5*1000=500
      expect(service.computeMatchLRScore(0.5, 0, 20)).toBe(500);
    });

    it('applies speed bonus correctly (half-time response)', () => {
      // ratio=1, responseTime=10000ms, timerSeconds=20 → speedBonus=750 → 1*750=750
      expect(service.computeMatchLRScore(1, 10000, 20)).toBe(750);
    });
  });

  describe('auto-advance timer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('schedules auto-advance after startSession', async () => {
      const template = {
        id: 'tmpl-1',
        createdBy: 'teacher-1',
        questions: [
          { id: 'q1', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 10, order: 1, options: [] },
        ],
      };
      mockPrisma.gameSession.findFirst.mockResolvedValue(null);
      mockPrisma.gameTemplate.findUnique.mockResolvedValue(template);
      mockPrisma.gameSession.create.mockResolvedValue({
        id: 'gs1',
        templateId: 'tmpl-1',
        sessionId: 'meet-1',
        startedBy: 'teacher-1',
        status: 'IN_PROGRESS',
        currentQuestionIndex: 0,
        template: { questions: template.questions },
      });

      await service.startSession('tmpl-1', 'meet-1', 'teacher-1');

      // Timer should be scheduled
      expect(jest.getTimerCount()).toBe(1);
    });

    it('auto-ends (reveals) the current question when the timer fires', async () => {
      const questions = [
        { id: 'q1', type: 'MULTIPLE_CHOICE', text: 'Q1', correctAnswer: 'A', timerSeconds: 10, order: 1, options: [], matchPairs: [] },
        { id: 'q2', type: 'MULTIPLE_CHOICE', text: 'Q2', correctAnswer: 'B', timerSeconds: 10, order: 2, options: [], matchPairs: [] },
      ];
      const session = {
        id: 'gs1',
        status: 'IN_PROGRESS',
        startedBy: 'teacher-1',
        currentQuestionIndex: 0,
        template: { questions },
      };
      mockPrisma.gameSession.findFirst.mockResolvedValue(null);
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({ id: 'tmpl-1', createdBy: 'teacher-1', questions });
      mockPrisma.gameSession.create.mockResolvedValue({ ...session, template: { questions } });
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);
      mockPrisma.gameParticipant.count.mockResolvedValue(0);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 1 });

      await service.startSession('tmpl-1', 'meet-1', 'teacher-1');
      jest.advanceTimersByTime(10001);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'game.question.ended',
        expect.objectContaining({ gameSessionId: 'gs1', questionId: 'q1' }),
      );
      expect(mockPrisma.gameSession.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentQuestionIndex: 1 } }),
      );
    });
  });

  describe('pauseSession', () => {
    const session = {
      id: 'gs1', status: 'IN_PROGRESS', startedBy: 'teacher-1',
      currentQuestionIndex: 0,
      template: { questions: [{ id: 'q1', timerSeconds: 20 }] },
    };

    it('sets status to PAUSED and emits game.session.paused', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameSession.update.mockResolvedValue({ ...session, status: 'PAUSED' });

      await service.pauseSession('gs1', 'teacher-1');

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAUSED' }) }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('game.session.paused', expect.objectContaining({ gameSessionId: 'gs1' }));
    });

    it('throws ForbiddenException if not the teacher', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      await expect(service.pauseSession('gs1', 'other')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if not IN_PROGRESS', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({ ...session, status: 'ENDED' });
      await expect(service.pauseSession('gs1', 'teacher-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resumeSession', () => {
    const session = {
      id: 'gs1', status: 'PAUSED', startedBy: 'teacher-1',
      currentQuestionIndex: 0,
      template: { questions: [{ id: 'q1', timerSeconds: 20 }] },
    };

    it('sets status to IN_PROGRESS and emits game.session.resumed', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameSession.update.mockResolvedValue({ ...session, status: 'IN_PROGRESS' });

      await service.resumeSession('gs1', 'teacher-1');

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'IN_PROGRESS' }) }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('game.session.resumed', expect.any(Object));
    });

    it('throws BadRequestException if not PAUSED', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({ ...session, status: 'IN_PROGRESS' });
      await expect(service.resumeSession('gs1', 'teacher-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('extendTimer', () => {
    const session = {
      id: 'gs1', status: 'IN_PROGRESS', startedBy: 'teacher-1',
      currentQuestionIndex: 0,
      template: { questions: [{ id: 'q1', timerSeconds: 20 }] },
    };

    it('emits game.timer.extended with correct payload', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);

      await service.extendTimer('gs1', 'teacher-1', 30);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'game.timer.extended',
        expect.objectContaining({ gameSessionId: 'gs1', extraSeconds: 30 }),
      );
    });

    it('throws ForbiddenException if not the teacher', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      await expect(service.extendTimer('gs1', 'other', 30)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('skipQuestion', () => {
    const session = {
      id: 'gs1', status: 'IN_PROGRESS', startedBy: 'teacher-1',
      currentQuestionIndex: 0,
      template: { questions: [
        { id: 'q1', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 20, options: [], matchPairs: [] },
        { id: 'q2', type: 'MULTIPLE_CHOICE', correctAnswer: 'B', timerSeconds: 20, options: [], matchPairs: [] },
      ] },
    };

    it('advances to next question (same as nextQuestion)', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);
      mockPrisma.gameParticipant.count.mockResolvedValue(0);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 1 });

      await service.skipQuestion('gs1', 'teacher-1');

      expect(mockPrisma.gameSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentQuestionIndex: 1 } }),
      );
    });
  });

  describe('nextQuestion — race condition + distribution', () => {
    const baseSession = {
      id: 'session-1',
      status: 'IN_PROGRESS',
      startedBy: 'teacher-1',
      currentQuestionIndex: 0,
      template: {
        questions: [
          { id: 'q1', type: 'MULTIPLE_CHOICE', correctAnswer: 'B', timerSeconds: 20, order: 1, options: [
            { id: 'o1', label: 'A', text: 'Wrong' },
            { id: 'o2', label: 'B', text: 'Correct' },
          ], matchPairs: [] },
          { id: 'q2', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 20, order: 2, options: [], matchPairs: [] },
        ],
      },
    };

    it('includes distribution in game.question.ended event', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(baseSession);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([
        { answer: 'A', participantId: 'p1', userId: 'u1', pointsAwarded: 0 },
        { answer: 'B', participantId: 'p2', userId: 'u2', pointsAwarded: 800 },
        { answer: 'B', participantId: 'p3', userId: 'u3', pointsAwarded: 700 },
      ]);
      mockPrisma.gameParticipant.count.mockResolvedValue(3);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 1 });

      await service.nextQuestion('session-1', 'teacher-1');

      const endedCall = mockEventEmitter.emit.mock.calls.find((c) => c[0] === 'game.question.ended');
      expect(endedCall).toBeDefined();
      const payload = endedCall![1];
      expect(payload.distribution).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'A', count: 1, isCorrect: false }),
          expect.objectContaining({ label: 'B', count: 2, isCorrect: true }),
        ]),
      );
      expect(payload.unansweredCount).toBeDefined();
    });

    it('throws ConflictException when updateMany returns count 0 (race condition)', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(baseSession);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);
      mockPrisma.gameParticipant.count.mockResolvedValue(0);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.nextQuestion('session-1', 'teacher-1')).rejects.toThrow(ConflictException);
    });

    it('emits word_cloud_updated for WORD_CLOUD questions', async () => {
      const wcSession = {
        ...baseSession,
        template: {
          questions: [
            { id: 'q1', type: 'WORD_CLOUD', correctAnswer: '', timerSeconds: 20, order: 1, options: [], matchPairs: [] },
            { id: 'q2', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 20, order: 2, options: [], matchPairs: [] },
          ],
        },
      };
      mockPrisma.gameSession.findUnique.mockResolvedValue(wcSession);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([
        { answer: 'happy', participantId: 'p1', userId: 'u1', pointsAwarded: 100 },
        { answer: 'joy', participantId: 'p2', userId: 'u2', pointsAwarded: 100 },
        { answer: 'happy', participantId: 'p3', userId: 'u3', pointsAwarded: 100 },
      ]);
      mockPrisma.gameParticipant.count.mockResolvedValue(3);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 1 });

      await service.nextQuestion('session-1', 'teacher-1');

      const wcCall = mockEventEmitter.emit.mock.calls.find((c) => c[0] === 'game.word_cloud.updated');
      expect(wcCall).toBeDefined();
      const words = wcCall![1].words;
      expect(words).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: 'happy', count: 2 }),
          expect.objectContaining({ text: 'joy', count: 1 }),
        ]),
      );
    });
  });

  describe('hideWord', () => {
    it('adds word to hiddenWords JSON array in GameSession', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs1', status: 'IN_PROGRESS', startedBy: 'teacher-1', hiddenWords: null,
      });
      mockPrisma.gameSession.update.mockResolvedValue({});

      await service.hideWord('gs1', 'teacher-1', 'badword');

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hiddenWords: JSON.stringify(['badword']) }),
        }),
      );
    });

    it('appends to existing hiddenWords list', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs1', status: 'IN_PROGRESS', startedBy: 'teacher-1', hiddenWords: JSON.stringify(['first']),
      });
      mockPrisma.gameSession.update.mockResolvedValue({});

      await service.hideWord('gs1', 'teacher-1', 'second');

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hiddenWords: JSON.stringify(['first', 'second']) }),
        }),
      );
    });
  });

  describe('submitAnswer — new question types', () => {
    it('handles MULTI_CHOICE: exact set match scores points', async () => {
      const session = {
        id: 'gs1', status: 'IN_PROGRESS', currentQuestionIndex: 0,
        template: { questions: [{ id: 'q1', type: 'MULTI_CHOICE', correctAnswer: 'A,C', timerSeconds: 20, options: [], matchPairs: [] }] },
      };
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p1', answerStreak: 0, maxAnswerStreak: 0 });
      mockPrisma.gameAnswer.findUnique.mockResolvedValue(null);
      mockPrisma.gameAnswer.create.mockResolvedValue({});
      mockPrisma.gameParticipant.update.mockResolvedValue({ answerStreak: 1, maxAnswerStreak: 1 });

      const result = await service.submitAnswer('gs1', 'u1', 'C,A');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
      expect(result.answerStreak).toBe(1);
    });

    it('handles WORD_CLOUD: always correct, always 100 pts', async () => {
      const session = {
        id: 'gs1', status: 'IN_PROGRESS', currentQuestionIndex: 0,
        template: { questions: [{ id: 'q1', type: 'WORD_CLOUD', correctAnswer: '', timerSeconds: 20, options: [], matchPairs: [] }] },
      };
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p1', answerStreak: 0, maxAnswerStreak: 0 });
      mockPrisma.gameAnswer.findUnique.mockResolvedValue(null);
      mockPrisma.gameAnswer.create.mockResolvedValue({});
      mockPrisma.gameParticipant.update.mockResolvedValue({ answerStreak: 1, maxAnswerStreak: 1 });

      const result = await service.submitAnswer('gs1', 'u1', 'happy');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(100);
    });

    it('handles MATCH_LR: partial credit, updates streak', async () => {
      const session = {
        id: 'gs1', status: 'IN_PROGRESS', currentQuestionIndex: 0,
        template: { questions: [{
          id: 'q1', type: 'MATCH_LR', correctAnswer: '', timerSeconds: 20, options: [],
          matchPairs: [
            { leftLabel: 'A', rightText: 'Joyful' },
            { leftLabel: 'B', rightText: 'Sad' },
          ],
        }] },
      };
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p1', answerStreak: 2, maxAnswerStreak: 2 });
      mockPrisma.gameAnswer.findUnique.mockResolvedValue(null);
      mockPrisma.gameAnswer.create.mockResolvedValue({});
      mockPrisma.gameParticipant.update.mockResolvedValue({ answerStreak: 0, maxAnswerStreak: 2 });

      // Submit only 1 of 2 pairs correct → ratio=0.5 → partial points, isCorrect=false
      const submitted = JSON.stringify([{ left: 'A', right: 'Joyful' }, { left: 'B', right: 'Wrong' }]);
      const result = await service.submitAnswer('gs1', 'u1', submitted);
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBeGreaterThan(0);
      expect(result.pointsAwarded).toBeLessThan(1000);
    });

    it('streak increments on correct answer', async () => {
      const session = {
        id: 'gs1', status: 'IN_PROGRESS', currentQuestionIndex: 0,
        template: { questions: [{ id: 'q1', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 20, options: [], matchPairs: [] }] },
      };
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p1', answerStreak: 3, maxAnswerStreak: 3 });
      mockPrisma.gameAnswer.findUnique.mockResolvedValue(null);
      mockPrisma.gameAnswer.create.mockResolvedValue({});
      mockPrisma.gameParticipant.update.mockResolvedValue({ answerStreak: 4, maxAnswerStreak: 4 });

      const result = await service.submitAnswer('gs1', 'u1', 'A');
      expect(result.answerStreak).toBe(4);
      expect(result.maxAnswerStreak).toBe(4);
      // streak update called with increment
      expect(mockPrisma.gameParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ answerStreak: { increment: 1 } }),
        }),
      );
    });

    it('streak resets on wrong answer', async () => {
      const session = {
        id: 'gs1', status: 'IN_PROGRESS', currentQuestionIndex: 0,
        template: { questions: [{ id: 'q1', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 20, options: [], matchPairs: [] }] },
      };
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p1', answerStreak: 5, maxAnswerStreak: 5 });
      mockPrisma.gameAnswer.findUnique.mockResolvedValue(null);
      mockPrisma.gameAnswer.create.mockResolvedValue({});
      mockPrisma.gameParticipant.update.mockResolvedValue({ answerStreak: 0, maxAnswerStreak: 5 });

      const result = await service.submitAnswer('gs1', 'u1', 'B');
      expect(result.answerStreak).toBe(0);
      expect(mockPrisma.gameParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ answerStreak: 0 }),
        }),
      );
    });
  });

  describe('getSessionStats', () => {
    it('returns per-question stats with distribution and summary', async () => {
      const session = {
        id: 'gs1',
        status: 'ENDED',
        startedBy: 'teacher-1',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        endedAt: new Date('2025-01-01T10:15:00Z'),
        template: {
          questions: [
            { id: 'q1', text: 'Q1?', type: 'MULTIPLE_CHOICE', correctAnswer: 'B', timerSeconds: 20, order: 1, options: [
              { id: 'o1', label: 'A', text: 'Wrong' },
              { id: 'o2', label: 'B', text: 'Correct' },
            ], matchPairs: [] },
          ],
        },
      };
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameParticipant.findMany.mockResolvedValue([
        { id: 'p1', userId: 'u1', score: 800 },
        { id: 'p2', userId: 'u2', score: 0 },
      ]);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([
        { participantId: 'p1', questionId: 'q1', answer: 'B', isCorrect: true, responseTimeMs: 3000 },
        { participantId: 'p2', questionId: 'q1', answer: 'A', isCorrect: false, responseTimeMs: 8000 },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', full_name: 'Alice' },
        { id: 'u2', full_name: 'Bob' },
      ]);

      const result = await service.getSessionStats('gs1', 'teacher-1');

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].correctCount).toBe(1);
      expect(result.questions[0].incorrectCount).toBe(1);
      expect(result.questions[0].unansweredCount).toBe(0);
      expect(result.questions[0].difficultyScore).toBeCloseTo(0.5);
      expect(result.summary.participantCount).toBe(2);
      expect(result.summary.avgAccuracy).toBe(50);
    });

    it('throws ForbiddenException if caller is not the session owner', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs1', status: 'ENDED', startedBy: 'teacher-1',
        template: { questions: [] },
      });
      await expect(service.getSessionStats('gs1', 'other')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exportSession', () => {
    const session = {
      id: 'gs1',
      status: 'ENDED',
      startedBy: 'teacher-1',
      template: { questions: [] },
    };
    const participants = [
      { id: 'p1', userId: 'u1', score: 900, sessionId: 'gs1' },
      { id: 'p2', userId: 'u2', score: 400, sessionId: 'gs1' },
    ];
    const users = [
      { id: 'u1', full_name: 'Alice' },
      { id: 'u2', full_name: 'Bob' },
    ];
    const answers = [
      { participantId: 'p1', sessionId: 'gs1', isCorrect: true,  responseTimeMs: 2000 },
      { participantId: 'p1', sessionId: 'gs1', isCorrect: true,  responseTimeMs: 3000 },
      { participantId: 'p2', sessionId: 'gs1', isCorrect: false, responseTimeMs: 5000 },
      { participantId: 'p2', sessionId: 'gs1', isCorrect: true,  responseTimeMs: 6000 },
    ];

    it('CSV happy path: returns a string with correct headers and student names', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameParticipant.findMany.mockResolvedValue(participants);
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.gameAnswer.findMany.mockResolvedValue(answers);

      const result = await service.exportSession('gs1', 'teacher-1', 'csv');

      expect(typeof result).toBe('string');
      expect(result as string).toMatch(/^studentName,score,accuracy/);
      expect(result as string).toContain('Alice');
      expect(result as string).toContain('Bob');
      expect(result as string).toContain(',900,'); // score for Alice
    });

    it('escapes special characters in student names for CSV', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({
        id: 'gs1', status: 'ENDED', startedBy: 'teacher-1',
        template: { questions: [] },
      });
      mockPrisma.gameParticipant.findMany.mockResolvedValue([
        { id: 'p1', userId: 'u1', score: 100 },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', full_name: '=HYPERLINK("evil.com","click me")' },
      ]);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);

      const result = await service.exportSession('gs1', 'teacher-1', 'csv') as string;
      // The field must not open with a bare =HYPERLINK (i.e. "=HYPERLINK at start of quoted value)
      expect(result).not.toMatch(/"=HYPERLINK/);
      expect(result).toContain("'=HYPERLINK");
    });

    it('JSON happy path: returns array with expected fields per student', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameParticipant.findMany.mockResolvedValue(participants);
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.gameAnswer.findMany.mockResolvedValue(answers);

      const result = await service.exportSession('gs1', 'teacher-1', 'json');

      expect(Array.isArray(result)).toBe(true);
      const rows = result as Array<Record<string, unknown>>;
      expect(rows[0]).toMatchObject({
        studentName: expect.any(String),
        score: expect.any(Number),
        accuracy: expect.any(Number),
        correctCount: expect.any(Number),
      });
    });

    it('throws ForbiddenException when requesterId is not the session owner', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({ ...session, startedBy: 'teacher-1' });

      await expect(service.exportSession('gs1', 'other', 'csv')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when session does not exist', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);

      await expect(service.exportSession('gs1', 'teacher-1', 'csv')).rejects.toThrow(NotFoundException);
    });
  });

  describe('nextQuestion', () => {
    const baseSession = {
      id: 'session-1',
      status: 'IN_PROGRESS',
      startedBy: 'teacher-1',
      currentQuestionIndex: 0,
      template: {
        questions: [
          { id: 'q1', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 20, order: 1, options: [] },
          { id: 'q2', type: 'MULTIPLE_CHOICE', correctAnswer: 'B', timerSeconds: 20, order: 2, options: [] },
        ],
      },
    };

    it('throws ForbiddenException if caller is not the session owner', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(baseSession);

      await expect(service.nextQuestion('session-1', 'not-teacher')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if game is already ENDED', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue({ ...baseSession, status: 'ENDED' });

      await expect(service.nextQuestion('session-1', 'teacher-1')).rejects.toThrow(BadRequestException);
    });

    it('advances to next question and emits game.question.started', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(baseSession);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);
      mockPrisma.gameParticipant.count.mockResolvedValue(0);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 1 });

      await service.nextQuestion('session-1', 'teacher-1');

      expect(mockPrisma.gameSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentQuestionIndex: 1 } }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('game.question.ended', expect.objectContaining({ questionId: 'q1' }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('game.question.started', expect.objectContaining({ questionIndex: 1 }));
    });

    it('ends session when advancing past last question', async () => {
      const lastQ = { ...baseSession, currentQuestionIndex: 1 };
      mockPrisma.gameSession.findUnique.mockResolvedValue(lastQ);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);
      mockPrisma.gameParticipant.count.mockResolvedValue(0);
      mockPrisma.gameSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.gameParticipant.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.nextQuestion('session-1', 'teacher-1');

      expect(mockPrisma.gameSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ENDED' }) }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('game.session.ended', expect.objectContaining({ gameSessionId: 'session-1' }));
    });
  });
});
