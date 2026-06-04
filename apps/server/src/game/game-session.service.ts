import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GameSessionService {
  // Tracks when the current question started: gameSessionId → Date
  private questionStartedAt = new Map<string, Date>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Pure helpers (public for testability) ──────────────────────────────

  computeScore(responseTimeMs: number, timerSeconds: number, isCorrect: boolean): number {
    if (!isCorrect) return 0;
    const ratio = Math.min(1, responseTimeMs / (timerSeconds * 1000));
    return Math.min(1000, Math.max(500, Math.round(500 + 500 * (1 - ratio))));
  }

  checkAnswer(type: 'MULTIPLE_CHOICE' | 'FILL_BLANK', correct: string, submitted: string): boolean {
    if (type === 'MULTIPLE_CHOICE') {
      return correct.trim().toUpperCase() === submitted.trim().toUpperCase();
    }
    const a = correct.toLowerCase().trim();
    const b = submitted.toLowerCase().trim();
    const tolerance = Math.floor(a.length / 5);
    return this.levenshtein(a, b) <= tolerance;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  // ── Session lifecycle ──────────────────────────────────────────────────

  async startSession(templateId: string, meetingSessionId: string, startedBy: string) {
    const existing = await this.prisma.gameSession.findFirst({
      where: { sessionId: meetingSessionId, status: 'IN_PROGRESS' },
    });
    if (existing) throw new ConflictException('A game is already in progress for this meeting');

    const template = await this.prisma.gameTemplate.findUnique({
      where: { id: templateId },
      include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
    });
    if (!template) throw new NotFoundException('Game template not found');
    if (template.createdBy !== startedBy) throw new ForbiddenException('Not your template');
    if (template.questions.length === 0) throw new BadRequestException('Template has no questions');

    const session = await this.prisma.gameSession.create({
      data: {
        templateId,
        sessionId: meetingSessionId,
        startedBy,
        status: 'IN_PROGRESS',
        currentQuestionIndex: 0,
      },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });

    this.questionStartedAt.set(session.id, new Date());

    this.eventEmitter.emit('game.session.started', {
      meetingSessionId,
      gameSessionId: session.id,
      title: template.title,
      questionCount: template.questions.length,
    });

    const firstQuestion = template.questions[0];
    this.eventEmitter.emit('game.question.started', {
      gameSessionId: session.id,
      questionIndex: 0,
      text: firstQuestion.text,
      type: firstQuestion.type,
      options: firstQuestion.options,
      timerSeconds: firstQuestion.timerSeconds,
      elapsedSeconds: 0,
    });

    return session;
  }

  async nextQuestion(gameSessionId: string, requesterId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can advance questions');
    if (session.status === 'ENDED') throw new BadRequestException('Game has already ended');

    const questions = session.template.questions;
    const currentQuestion = questions[session.currentQuestionIndex];

    const questionAnswers = await this.prisma.gameAnswer.findMany({
      where: { sessionId: gameSessionId, questionId: currentQuestion.id },
      include: { participant: true },
    });

    this.eventEmitter.emit('game.question.ended', {
      gameSessionId,
      correctAnswer: currentQuestion.correctAnswer,
      questionId: currentQuestion.id,
      questionPoints: questionAnswers.map((a) => ({
        userId: a.participant.userId,
        pointsAwarded: a.pointsAwarded,
      })),
    });

    const nextIndex = session.currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      const updated = await this.prisma.gameSession.update({
        where: { id: gameSessionId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      this.questionStartedAt.delete(gameSessionId);

      const leaderboard = await this.buildLeaderboard(gameSessionId);
      this.eventEmitter.emit('game.session.ended', { gameSessionId, leaderboard });
      return updated;
    }

    const updated = await this.prisma.gameSession.update({
      where: { id: gameSessionId },
      data: { currentQuestionIndex: nextIndex },
    });
    this.questionStartedAt.set(gameSessionId, new Date());

    const nextQuestion = questions[nextIndex];
    this.eventEmitter.emit('game.question.started', {
      gameSessionId,
      questionIndex: nextIndex,
      text: nextQuestion.text,
      type: nextQuestion.type,
      options: nextQuestion.options,
      timerSeconds: nextQuestion.timerSeconds,
      elapsedSeconds: 0,
    });

    return updated;
  }

  async submitAnswer(gameSessionId: string, userId: string, answer: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('No active question');

    const currentQuestion = session.template.questions[session.currentQuestionIndex];

    const participant = await this.prisma.gameParticipant.upsert({
      where: { sessionId_userId: { sessionId: gameSessionId, userId } },
      create: {
        sessionId: gameSessionId,
        userId,
        lastSeenQuestionIndex: session.currentQuestionIndex,
      },
      update: {
        lastSeenQuestionIndex: session.currentQuestionIndex,
        lastActiveAt: new Date(),
      },
    });

    const existing = await this.prisma.gameAnswer.findUnique({
      where: { participantId_questionId: { participantId: participant.id, questionId: currentQuestion.id } },
    });
    if (existing) throw new ConflictException('Answer already submitted for this question');

    const startedAt = this.questionStartedAt.get(gameSessionId) ?? new Date();
    const responseTimeMs = Date.now() - startedAt.getTime();
    const isCorrect = this.checkAnswer(
      currentQuestion.type as 'MULTIPLE_CHOICE' | 'FILL_BLANK',
      currentQuestion.correctAnswer,
      answer,
    );
    const pointsAwarded = this.computeScore(responseTimeMs, currentQuestion.timerSeconds, isCorrect);

    try {
      await this.prisma.gameAnswer.create({
        data: {
          sessionId: gameSessionId,
          questionId: currentQuestion.id,
          participantId: participant.id,
          answer,
          isCorrect,
          responseTimeMs,
          pointsAwarded,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Answer already submitted for this question');
      }
      throw e;
    }

    await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: { score: { increment: pointsAwarded } },
    });

    this.eventEmitter.emit('game.leaderboard.update_requested', { gameSessionId });

    return { isCorrect, pointsAwarded, responseTimeMs };
  }

  async getActiveSession(meetingSessionId: string) {
    return this.prisma.gameSession.findFirst({
      where: { sessionId: meetingSessionId, status: 'IN_PROGRESS' },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });
  }

  async getLeaderboard(gameSessionId: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: gameSessionId } });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.status !== 'ENDED') throw new BadRequestException('Leaderboard only available after game ends');
    return this.buildLeaderboard(gameSessionId);
  }

  async buildLeaderboard(gameSessionId: string) {
    const participants = await this.prisma.gameParticipant.findMany({
      where: { sessionId: gameSessionId },
      orderBy: { score: 'desc' },
    });
    const userIds = participants.map((p) => p.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, full_name: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.full_name]));
    return participants.map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      displayName: nameMap.get(p.userId) ?? p.userId,
      score: p.score,
    }));
  }

  async getSessionById(gameSessionId: string) {
    return this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });
  }

  getQuestionElapsedSeconds(gameSessionId: string): number {
    const startedAt = this.questionStartedAt.get(gameSessionId);
    if (!startedAt) return 0;
    return Math.floor((Date.now() - startedAt.getTime()) / 1000);
  }
}
