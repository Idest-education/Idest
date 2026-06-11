import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';

interface SessionStats {
  userId: string;
  classId: string;
  isWinner: boolean;
  accuracy: number;        // 0-100
  avgResponseTimeMs: number;
  totalAnswers: number;
  correctAnswers: number;
  allCorrect: boolean;
}

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async checkAndAward(gameSessionId: string): Promise<void> {
    try {
      const gameSession = await this.prisma.gameSession.findUnique({ where: { id: gameSessionId } });
      if (!gameSession) throw new NotFoundException('Game session not found');

      const meetingSession = await this.prisma.session.findUnique({ where: { id: gameSession.sessionId } });
      if (!meetingSession) throw new NotFoundException('Meeting session not found');
      const classId = meetingSession.class_id;

      const participants = await this.prisma.gameParticipant.findMany({
        where: { sessionId: gameSessionId },
        orderBy: { score: 'desc' },
      });
      if (participants.length === 0) return;

      const answers = await this.prisma.gameAnswer.findMany({ where: { sessionId: gameSessionId } });
      const allMedals = await this.prisma.gameMedal.findMany();

      const topScore = participants[0].score;

      for (const participant of participants) {
        const myAnswers = answers.filter((a) => a.participantId === participant.id);
        const correct = myAnswers.filter((a) => a.isCorrect).length;
        const avgMs =
          myAnswers.length > 0
            ? myAnswers.reduce((s, a) => s + a.responseTimeMs, 0) / myAnswers.length
            : 0;

        const sessionStat: SessionStats = {
          userId: participant.userId,
          classId,
          isWinner: participant.score === topScore,
          accuracy: myAnswers.length > 0 ? Math.round((correct / myAnswers.length) * 100) : 0,
          avgResponseTimeMs: avgMs,
          totalAnswers: myAnswers.length,
          correctAnswers: correct,
          allCorrect: myAnswers.length > 0 && correct === myAnswers.length,
        };

        const classStats = await this.prisma.gameClassStats.findUnique({
          where: { classId_userId: { classId, userId: participant.userId } },
        });

        const alreadyAwarded = await this.prisma.gameMedalAward.findMany({
          where: { userId: participant.userId, classId },
        });
        const awardedKeys = new Set(
          alreadyAwarded
            .map((a) => allMedals.find((m) => m.id === a.medalId)?.key)
            .filter(Boolean),
        );

        for (const medal of allMedals) {
          if (awardedKeys.has(medal.key)) continue;
          if (!this.qualifies(medal.key, sessionStat, classStats)) continue;

          try {
            await this.prisma.gameMedalAward.create({
              data: { medalId: medal.id, userId: participant.userId, classId },
            });
            this.eventEmitter.emit('game.medal.earned', {
              userId: participant.userId,
              classId,
              medal: {
                key: medal.key,
                name: medal.name,
                description: medal.description,
                icon: medal.icon,
              },
            });
          } catch (err) {
            this.logger.warn(
              `Medal award skipped (${medal.key} for ${participant.userId}): ${err}`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(`checkAndAward failed for ${gameSessionId}: ${err}`);
      // swallow — must not roll back session end
    }
  }

  private qualifies(
    key: string,
    session: SessionStats,
    stats: {
      totalWins: number;
      consecutiveWins: number;
      maxConsecWins: number;
      totalGames: number;
      correctAnswers: number;
      totalAnswers: number;
    } | null,
  ): boolean {
    if (!stats) return false;
    switch (key) {
      // Winning
      case 'WINS_3':   return stats.totalWins >= 3;
      case 'WINS_10':  return stats.totalWins >= 10;
      case 'WINS_50':  return stats.totalWins >= 50;
      case 'WINS_100': return stats.totalWins >= 100;
      // Streak
      case 'CONSEC_WIN_3':  return stats.consecutiveWins >= 3 || stats.maxConsecWins >= 3;
      case 'CONSEC_WIN_5':  return stats.consecutiveWins >= 5 || stats.maxConsecWins >= 5;
      case 'CONSEC_WIN_10': return stats.consecutiveWins >= 10 || stats.maxConsecWins >= 10;
      // Leaderboard — awarded by cron, not per-session
      case 'RANK1_WEEK':  return false;
      case 'RANK1_MONTH': return false;
      // Participation
      case 'GAMES_10':  return stats.totalGames >= 10;
      case 'GAMES_50':  return stats.totalGames >= 50;
      case 'GAMES_100': return stats.totalGames >= 100;
      // Accuracy (per-session, minimum 3 answers)
      case 'ACC_90':  return session.accuracy >= 90 && session.totalAnswers >= 3;
      case 'ACC_95':  return session.accuracy >= 95 && session.totalAnswers >= 3;
      case 'ACC_100': return session.allCorrect && session.totalAnswers >= 3;
      // Speed (per-session, minimum 3 answers)
      case 'SPEED_FAST':      return session.avgResponseTimeMs < 5000 && session.totalAnswers >= 3;
      case 'SPEED_LIGHTNING': return session.avgResponseTimeMs < 3000 && session.totalAnswers >= 3;
      case 'SPEED_DEMON':
        return (
          session.avgResponseTimeMs < 2000 &&
          session.allCorrect &&
          session.totalAnswers >= 3
        );
      default: return false;
    }
  }
}
