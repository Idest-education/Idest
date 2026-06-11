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

const mockPrisma = {
  gameSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gameTemplate: { findUnique: jest.fn() },
  gameParticipant: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  gameAnswer: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  user: { findMany: jest.fn() },
};
const mockEventEmitter = { emit: jest.fn() };

describe('GameSessionService', () => {
  let service: GameSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameSessionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
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

    it('auto-advances question when timer fires', async () => {
      const questions = [
        { id: 'q1', type: 'MULTIPLE_CHOICE', correctAnswer: 'A', timerSeconds: 10, order: 1, options: [] },
        { id: 'q2', type: 'MULTIPLE_CHOICE', correctAnswer: 'B', timerSeconds: 10, order: 2, options: [] },
      ];
      const session = {
        id: 'gs1',
        status: 'IN_PROGRESS',
        startedBy: 'teacher-1',
        currentQuestionIndex: 0,
        template: { questions },
      };
      mockPrisma.gameSession.findFirst.mockResolvedValue(null);
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        createdBy: 'teacher-1',
        questions,
      });
      mockPrisma.gameSession.create.mockResolvedValue({ ...session, template: { questions } });
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);
      mockPrisma.gameSession.update.mockResolvedValue({ ...session, currentQuestionIndex: 1 });

      await service.startSession('tmpl-1', 'meet-1', 'teacher-1');
      jest.advanceTimersByTime(10001);
      // flush microtasks — multiple rounds needed for the async nextQuestion chain
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
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
      template: { questions: [{ id: 'q1', timerSeconds: 20 }, { id: 'q2', timerSeconds: 20 }] },
    };

    it('advances to next question (same as nextQuestion)', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(session);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);
      mockPrisma.gameSession.update.mockResolvedValue({ ...session, currentQuestionIndex: 1 });

      await service.skipQuestion('gs1', 'teacher-1');

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentQuestionIndex: 1 } }),
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
      mockPrisma.gameSession.update.mockResolvedValue({ ...baseSession, currentQuestionIndex: 1 });

      await service.nextQuestion('session-1', 'teacher-1');

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentQuestionIndex: 1 } }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('game.question.ended', expect.objectContaining({ questionId: 'q1' }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('game.question.started', expect.objectContaining({ questionIndex: 1 }));
    });

    it('ends session when advancing past last question', async () => {
      const lastQ = { ...baseSession, currentQuestionIndex: 1 };
      mockPrisma.gameSession.findUnique.mockResolvedValue(lastQ);
      mockPrisma.gameAnswer.findMany.mockResolvedValue([]);
      mockPrisma.gameSession.update.mockResolvedValue({ ...lastQ, status: 'ENDED' });
      mockPrisma.gameParticipant.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.nextQuestion('session-1', 'teacher-1');

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ENDED' }) }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('game.session.ended', expect.objectContaining({ gameSessionId: 'session-1' }));
    });
  });
});
