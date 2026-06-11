import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ClassStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateStats(gameSessionId: string): Promise<void> {
    const gameSession = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
    });
    if (!gameSession) throw new NotFoundException('Game session not found');

    const meetingSession = await this.prisma.session.findUnique({
      where: { id: gameSession.sessionId },
    });
    if (!meetingSession) throw new NotFoundException('Meeting session not found');

    const classId = meetingSession.class_id;

    const participants = await this.prisma.gameParticipant.findMany({
      where: { sessionId: gameSessionId },
      orderBy: { score: 'desc' },
    });

    if (participants.length === 0) return;

    const winnerScore = participants[0].score;
    const winnerId = participants[0].userId;

    const answers = await this.prisma.gameAnswer.findMany({
      where: { sessionId: gameSessionId },
    });

    for (const participant of participants) {
      const isWinner =
        participant.userId === winnerId && participant.score === winnerScore;
      const myAnswers = answers.filter(
        (a) => a.participantId === participant.id,
      );
      const correct = myAnswers.filter((a) => a.isCorrect).length;

      await this.prisma.gameClassStats.upsert({
        where: { classId_userId: { classId, userId: participant.userId } },
        create: {
          classId,
          userId: participant.userId,
          totalPoints: participant.score,
          weeklyPoints: participant.score,
          monthlyPoints: participant.score,
          totalWins: isWinner ? 1 : 0,
          totalGames: 1,
          correctAnswers: correct,
          totalAnswers: myAnswers.length,
          consecutiveWins: isWinner ? 1 : 0,
          maxConsecWins: isWinner ? 1 : 0,
        },
        update: {
          totalPoints: { increment: participant.score },
          weeklyPoints: { increment: participant.score },
          monthlyPoints: { increment: participant.score },
          totalGames: { increment: 1 },
          ...(isWinner && { totalWins: { increment: 1 } }),
          correctAnswers: { increment: correct },
          totalAnswers: { increment: myAnswers.length },
        },
      });

      // Update consecutiveWins after the record is guaranteed to exist
      if (isWinner) {
        await this.prisma.$executeRaw`
          UPDATE "GameClassStats"
          SET "consecutiveWins" = "consecutiveWins" + 1,
              "maxConsecWins" = GREATEST("maxConsecWins", "consecutiveWins" + 1)
          WHERE "classId" = ${classId} AND "userId" = ${participant.userId}
        `;
      } else {
        await this.prisma.gameClassStats.updateMany({
          where: { classId, userId: participant.userId },
          data: { consecutiveWins: 0 },
        });
      }
    }
  }

  @Cron('0 0 * * 0') // Every Sunday at midnight
  async resetWeeklyPoints(): Promise<void> {
    await this.prisma.gameClassStats.updateMany({
      data: { weeklyPoints: 0, weeklyResetAt: new Date() },
    });
  }

  @Cron('0 0 1 * *') // 1st of every month at midnight
  async resetMonthlyPoints(): Promise<void> {
    await this.prisma.gameClassStats.updateMany({
      data: { monthlyPoints: 0, monthlyResetAt: new Date() },
    });
  }
}
