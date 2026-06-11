import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassStatsService } from './class-stats.service';
import { AchievementService } from './achievement.service';

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);

  // Tracks when the current question started: gameSessionId → Date
  private questionStartedAt = new Map<string, Date>();
  private readonly autoTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly classStatsService: ClassStatsService,
    private readonly achievementService: AchievementService,
  ) {}

  // ── Pure helpers (public for testability) ──────────────────────────────

  computeScore(responseTimeMs: number, timerSeconds: number, isCorrect: boolean): number {
    if (!isCorrect) return 0;
    const ratio = Math.min(1, responseTimeMs / (timerSeconds * 1000));
    return Math.min(1000, Math.max(500, Math.round(500 + 500 * (1 - ratio))));
  }

  checkAnswer(
    type: 'MULTIPLE_CHOICE' | 'FILL_BLANK' | 'MULTI_CHOICE' | 'MATCH_LR' | 'WORD_CLOUD',
    correct: string,
    submitted: string,
  ): boolean {
    if (type === 'MULTIPLE_CHOICE') {
      return correct.trim().toUpperCase() === submitted.trim().toUpperCase();
    }
    if (type === 'MULTI_CHOICE') {
      const correctSet = new Set(correct.split(',').map((s) => s.trim().toUpperCase()));
      const submittedSet = new Set(submitted.split(',').map((s) => s.trim().toUpperCase()));
      if (correctSet.size !== submittedSet.size) return false;
      for (const v of correctSet) if (!submittedSet.has(v)) return false;
      return true;
    }
    if (type === 'WORD_CLOUD') {
      return true;
    }
    // FILL_BLANK
    const a = correct.toLowerCase().trim();
    const b = submitted.toLowerCase().trim();
    const tolerance = Math.floor(a.length / 5);
    return this.levenshtein(a, b) <= tolerance;
  }

  checkMatchLR(
    pairs: { leftLabel: string; rightText: string }[],
    submitted: { left: string; right: string }[],
  ): number {
    const correctMap = new Map(pairs.map((p) => [p.leftLabel, p.rightText]));
    let correct = 0;
    for (const s of submitted) {
      if (correctMap.get(s.left) === s.right) correct++;
    }
    return pairs.length === 0 ? 0 : correct / pairs.length;
  }

  computeMatchLRScore(ratio: number, responseTimeMs: number, timerSeconds: number): number {
    if (ratio === 0) return 0;
    const timeRatio = Math.min(1, responseTimeMs / (timerSeconds * 1000));
    const speedBonus = Math.min(1000, Math.max(500, Math.round(500 + 500 * (1 - timeRatio))));
    return Math.round(ratio * speedBonus);
  }

  private scheduleAutoAdvance(gameSessionId: string, timerSeconds: number): void {
    this.cancelAutoAdvance(gameSessionId);
    const timer = setTimeout(() => {
      void this.nextQuestion(gameSessionId, '__auto__');
    }, timerSeconds * 1000);
    this.autoTimers.set(gameSessionId, timer);
  }

  private cancelAutoAdvance(gameSessionId: string): void {
    const timer = this.autoTimers.get(gameSessionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.autoTimers.delete(gameSessionId);
    }
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
      include: { questions: { orderBy: { order: 'asc' }, include: { options: true, matchPairs: true } } },
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
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true, matchPairs: true } } } },
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

    this.scheduleAutoAdvance(session.id, firstQuestion.timerSeconds);

    return session;
  }

  async nextQuestion(gameSessionId: string, requesterId: string) {
    this.cancelAutoAdvance(gameSessionId);

    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true, matchPairs: true } } } },
      },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId && requesterId !== '__auto__') throw new ForbiddenException('Only the teacher can advance questions');
    if (session.status === 'ENDED') throw new BadRequestException('Game has already ended');

    const questions = session.template.questions;
    const currentQuestion = questions[session.currentQuestionIndex];

    const questionAnswers = await this.prisma.gameAnswer.findMany({
      where: { sessionId: gameSessionId, questionId: currentQuestion.id },
      include: { participant: true },
    });

    // Compute distribution and unanswered count for the ended question
    const distribution = this.computeDistribution(currentQuestion, questionAnswers);
    const totalParticipants = await this.prisma.gameParticipant.count({ where: { sessionId: gameSessionId } });
    const unansweredCount = totalParticipants - questionAnswers.length;

    this.eventEmitter.emit('game.question.ended', {
      gameSessionId,
      correctAnswer: currentQuestion.correctAnswer,
      questionId: currentQuestion.id,
      distribution,
      unansweredCount,
      questionPoints: questionAnswers.map((a) => ({
        userId: a.participant?.userId ?? a.participantId,
        pointsAwarded: a.pointsAwarded,
      })),
    });

    // Emit word cloud data when closing a WORD_CLOUD question
    if (currentQuestion.type === 'WORD_CLOUD') {
      const wordCount = new Map<string, number>();
      for (const a of questionAnswers) {
        wordCount.set(a.answer, (wordCount.get(a.answer) ?? 0) + 1);
      }
      const words = [...wordCount.entries()]
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count);
      this.eventEmitter.emit('game.word_cloud.updated', { gameSessionId, words });
    }

    const nextIndex = session.currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      // Race condition guard: only update if the session is still at the expected index
      const endResult = await this.prisma.gameSession.updateMany({
        where: { id: gameSessionId, status: 'IN_PROGRESS', currentQuestionIndex: session.currentQuestionIndex },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      if (endResult.count === 0) throw new ConflictException('Question already advanced by another request');

      this.questionStartedAt.delete(gameSessionId);

      const leaderboard = await this.buildLeaderboard(gameSessionId);
      this.eventEmitter.emit('game.session.ended', { gameSessionId, leaderboard });

      await this.classStatsService.updateStats(gameSessionId).catch((e) =>
        this.logger.warn('updateStats failed:', e),
      );
      await this.achievementService.checkAndAward(gameSessionId).catch((e) =>
        this.logger.warn('checkAndAward failed:', e),
      );

      return { ...session, status: 'ENDED' };
    }

    // Race condition guard: only advance if the session is still at the expected index
    const advanceResult = await this.prisma.gameSession.updateMany({
      where: { id: gameSessionId, status: 'IN_PROGRESS', currentQuestionIndex: session.currentQuestionIndex },
      data: { currentQuestionIndex: nextIndex },
    });
    if (advanceResult.count === 0) throw new ConflictException('Question already advanced by another request');

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

    this.scheduleAutoAdvance(gameSessionId, nextQuestion.timerSeconds);

    return { ...session, currentQuestionIndex: nextIndex };
  }

  async submitAnswer(gameSessionId: string, userId: string, answer: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: { options: true, matchPairs: true },
            },
          },
        },
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

    let isCorrect: boolean;
    let pointsAwarded: number;

    if (currentQuestion.type === 'MATCH_LR') {
      let submitted: { left: string; right: string }[];
      try {
        submitted = JSON.parse(answer);
        if (!Array.isArray(submitted) || !submitted.every((s) => 'left' in s && 'right' in s)) {
          throw new Error();
        }
      } catch {
        throw new BadRequestException('Invalid MATCH_LR answer format — expected JSON array of {left, right}');
      }
      const ratio = this.checkMatchLR(currentQuestion.matchPairs, submitted);
      isCorrect = ratio === 1;
      pointsAwarded = this.computeMatchLRScore(ratio, responseTimeMs, currentQuestion.timerSeconds);
    } else if (currentQuestion.type === 'WORD_CLOUD') {
      isCorrect = true;
      pointsAwarded = 100;
    } else {
      isCorrect = this.checkAnswer(
        currentQuestion.type as 'MULTIPLE_CHOICE' | 'FILL_BLANK' | 'MULTI_CHOICE',
        currentQuestion.correctAnswer,
        answer,
      );
      pointsAwarded = this.computeScore(responseTimeMs, currentQuestion.timerSeconds, isCorrect);
    }

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

    const newStreak = isCorrect ? participant.answerStreak + 1 : 0;
    const newMax = Math.max(newStreak, participant.maxAnswerStreak);

    const updatedParticipant = await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        score: { increment: pointsAwarded },
        ...(isCorrect
          ? { answerStreak: { increment: 1 }, maxAnswerStreak: newMax }
          : { answerStreak: 0 }),
      },
    });

    this.eventEmitter.emit('game.leaderboard.update_requested', { gameSessionId });

    return {
      isCorrect,
      pointsAwarded,
      responseTimeMs,
      answerStreak: updatedParticipant.answerStreak,
      maxAnswerStreak: updatedParticipant.maxAnswerStreak,
    };
  }

  async getActiveSession(meetingSessionId: string) {
    return this.prisma.gameSession.findFirst({
      where: { sessionId: meetingSessionId, status: 'IN_PROGRESS' },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true, matchPairs: true } } } },
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
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true, matchPairs: true } } } },
      },
    });
  }

  getQuestionElapsedSeconds(gameSessionId: string): number {
    const startedAt = this.questionStartedAt.get(gameSessionId);
    if (!startedAt) return 0;
    return Math.floor((Date.now() - startedAt.getTime()) / 1000);
  }

  async pauseSession(gameSessionId: string, requesterId: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: gameSessionId } });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can pause');
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('Session is not in progress');

    this.cancelAutoAdvance(gameSessionId);
    const now = new Date();
    await this.prisma.gameSession.update({
      where: { id: gameSessionId },
      data: { status: 'PAUSED', pausedAt: now },
    });
    this.eventEmitter.emit('game.session.paused', { gameSessionId, pausedAt: now });
  }

  async resumeSession(gameSessionId: string, requesterId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: { template: { include: { questions: { orderBy: { order: 'asc' } } } } },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can resume');
    if (session.status !== 'PAUSED') throw new BadRequestException('Session is not paused');

    await this.prisma.gameSession.update({
      where: { id: gameSessionId },
      data: { status: 'IN_PROGRESS', pausedAt: null },
    });
    const elapsedSeconds = this.getQuestionElapsedSeconds(gameSessionId);
    const currentQuestion = session.template.questions[session.currentQuestionIndex];
    const remainingSeconds = Math.max(0, currentQuestion.timerSeconds - elapsedSeconds);
    this.scheduleAutoAdvance(gameSessionId, remainingSeconds);
    this.eventEmitter.emit('game.session.resumed', { gameSessionId, elapsedSeconds });
  }

  async extendTimer(gameSessionId: string, requesterId: string, extraSeconds: number) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: { template: { include: { questions: { orderBy: { order: 'asc' } } } } },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can extend');
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('Session is not in progress');

    this.cancelAutoAdvance(gameSessionId);
    const elapsedSeconds = this.getQuestionElapsedSeconds(gameSessionId);
    const currentQuestion = session.template.questions[session.currentQuestionIndex];
    const newTimerSeconds = currentQuestion.timerSeconds + extraSeconds;
    this.scheduleAutoAdvance(gameSessionId, Math.max(1, newTimerSeconds - elapsedSeconds));

    this.eventEmitter.emit('game.timer.extended', {
      gameSessionId,
      extraSeconds,
      newTimerSeconds,
      elapsedSeconds,
    });
  }

  async skipQuestion(gameSessionId: string, requesterId: string) {
    return this.nextQuestion(gameSessionId, requesterId);
  }

  async revealAnswer(gameSessionId: string, requesterId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: { template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true, matchPairs: true } } } } },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can reveal');
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('Session is not in progress');

    this.cancelAutoAdvance(gameSessionId);
    const currentQuestion = session.template.questions[session.currentQuestionIndex];
    const answers = await this.prisma.gameAnswer.findMany({
      where: { sessionId: gameSessionId, questionId: currentQuestion.id },
    });
    const distribution = this.computeDistribution(currentQuestion, answers);
    this.eventEmitter.emit('game.answer.revealed', {
      gameSessionId,
      correctAnswer: currentQuestion.correctAnswer,
      distribution,
    });
  }

  async hideWord(gameSessionId: string, requesterId: string, word: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: gameSessionId } });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can hide words');

    const existing: string[] = session.hiddenWords ? JSON.parse(session.hiddenWords) : [];
    if (!existing.includes(word)) existing.push(word);
    await this.prisma.gameSession.update({
      where: { id: gameSessionId },
      data: { hiddenWords: JSON.stringify(existing) },
    });
  }

  async getSessionStats(gameSessionId: string, requesterId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: { options: true, matchPairs: true },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can view stats');

    const questions = session.template.questions;
    const participants = await this.prisma.gameParticipant.findMany({
      where: { sessionId: gameSessionId },
    });
    const participantCount = participants.length;

    const allAnswersForSession = await this.prisma.gameAnswer.findMany({
      where: { sessionId: gameSessionId },
    });
    const answersByQuestion = new Map<string, typeof allAnswersForSession>();
    for (const a of allAnswersForSession) {
      if (!answersByQuestion.has(a.questionId)) answersByQuestion.set(a.questionId, []);
      answersByQuestion.get(a.questionId)!.push(a);
    }

    const questionStats = questions.map((q, idx) => {
        const answers = answersByQuestion.get(q.id) ?? [];
        const correctCount = answers.filter((a) => a.isCorrect).length;
        const incorrectCount = answers.filter((a) => !a.isCorrect).length;
        const unansweredCount = Math.max(0, participantCount - answers.length);
        const avgResponseTimeMs =
          answers.length > 0
            ? Math.round(answers.reduce((s, a) => s + a.responseTimeMs, 0) / answers.length)
            : 0;
        const totalResponses = answers.length;
        const correctRate = totalResponses > 0 ? correctCount / totalResponses : 0;
        const difficultyScore = Math.round((1 - correctRate) * 100) / 100;
        const distribution = this.computeDistribution(q, answers);

        return {
          questionIndex: idx,
          text: q.text,
          type: q.type,
          correctAnswer: q.correctAnswer,
          totalResponses,
          correctCount,
          incorrectCount,
          unansweredCount,
          avgResponseTimeMs,
          distribution,
          difficultyScore,
        };
      });

    const totalCorrect = questionStats.reduce((s, q) => s + q.correctCount, 0);
    const totalAnswered = questionStats.reduce((s, q) => s + q.totalResponses, 0);
    const avgAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const avgResponseTimeMs =
      questionStats.length > 0
        ? Math.round(questionStats.reduce((s, q) => s + q.avgResponseTimeMs, 0) / questionStats.length)
        : 0;
    const hardestQuestion =
      questionStats.length === 0
        ? null
        : questionStats.reduce((maxIdx, q, idx) =>
            q.difficultyScore > questionStats[maxIdx].difficultyScore ? idx : maxIdx, 0);
    const easiestQuestion =
      questionStats.length === 0
        ? null
        : questionStats.reduce((minIdx, q, idx) =>
            q.difficultyScore < questionStats[minIdx].difficultyScore ? idx : minIdx, 0);

    return {
      questions: questionStats,
      summary: {
        participantCount,
        avgAccuracy,
        avgResponseTimeMs,
        hardestQuestion,
        easiestQuestion,
        durationMs:
          session.endedAt && session.startedAt
            ? session.endedAt.getTime() - session.startedAt.getTime()
            : null,
      },
    };
  }

  async exportSession(gameSessionId: string, requesterId: string, format: 'csv' | 'json') {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can export');

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

    const answers = await this.prisma.gameAnswer.findMany({
      where: { sessionId: gameSessionId },
    });

    const rows = participants.map((p) => {
      const myAnswers = answers.filter((a) => a.participantId === p.id);
      const correct = myAnswers.filter((a) => a.isCorrect).length;
      const avgMs =
        myAnswers.length > 0
          ? Math.round(myAnswers.reduce((s, a) => s + a.responseTimeMs, 0) / myAnswers.length)
          : 0;
      return {
        studentName: nameMap.get(p.userId) ?? p.userId,
        score: p.score,
        accuracy: myAnswers.length > 0 ? Math.round((correct / myAnswers.length) * 100) : 0,
        avgResponseTimeMs: avgMs,
        answeredCount: myAnswers.length,
        correctCount: correct,
      };
    });

    if (format === 'json') return rows;

    // CSV
    const sanitizeCsvField = (s: string) =>
      '"' + String(s).replace(/"/g, '""').replace(/^[=+\-@\t\r]/, "'$&") + '"';

    const headers = 'studentName,score,accuracy,avgResponseTimeMs,answeredCount,correctCount\n';
    const csvRows = rows.map((r) =>
      `${sanitizeCsvField(r.studentName)},${r.score},${r.accuracy},${r.avgResponseTimeMs},${r.answeredCount},${r.correctCount}`,
    );
    return headers + csvRows.join('\n');
  }

  computeDistribution(
    question: { options: { label: string; text: string }[]; correctAnswer: string; type: string },
    answers: { answer: string }[],
  ) {
    const total = answers.length;
    const countMap = new Map<string, number>();
    for (const a of answers) {
      countMap.set(a.answer, (countMap.get(a.answer) ?? 0) + 1);
    }
    return question.options.map((opt) => ({
      label: opt.label,
      text: opt.text,
      count: countMap.get(opt.label) ?? 0,
      pct: total > 0 ? Math.round(((countMap.get(opt.label) ?? 0) / total) * 100) : 0,
      isCorrect: question.type === 'MULTI_CHOICE'
        ? question.correctAnswer.split(',').map((s) => s.trim()).includes(opt.label)
        : opt.label === question.correctAnswer,
    }));
  }
}
