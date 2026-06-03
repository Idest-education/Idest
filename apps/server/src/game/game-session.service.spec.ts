import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
  gameAnswer: { findUnique: jest.fn(), create: jest.fn() },
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
});
