import {
  Controller, Get, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { AchievementService } from './achievement.service';
import { ClassStatsService } from './class-stats.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('game-classes')
@ApiTags('Game Classes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AchievementController {
  constructor(
    private readonly achievementService: AchievementService,
    private readonly classStatsService: ClassStatsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':classId/leaderboard')
  @ApiOperation({ summary: 'Get class game leaderboard' })
  @ApiQuery({ name: 'period', enum: ['weekly', 'monthly', 'all-time'], required: false })
  async getLeaderboard(
    @Param('classId') classId: string,
    @Query('period') period: 'weekly' | 'monthly' | 'all-time' = 'all-time',
  ) {
    const orderBy = period === 'weekly' ? 'weeklyPoints'
      : period === 'monthly' ? 'monthlyPoints'
      : 'totalPoints';

    const stats = await this.prisma.gameClassStats.findMany({
      where: { classId },
      orderBy: { [orderBy]: 'desc' },
      take: 50,
    });

    const userIds = stats.map((s) => s.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, full_name: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.full_name]));

    return stats.map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      displayName: nameMap.get(s.userId) ?? s.userId,
      points: period === 'weekly' ? s.weeklyPoints : period === 'monthly' ? s.monthlyPoints : s.totalPoints,
      totalWins: s.totalWins,
      totalGames: s.totalGames,
    }));
  }

  @Get(':classId/medal-holders')
  @ApiOperation({ summary: 'Get user IDs with at least 1 medal in this class' })
  async getMedalHolders(@Param('classId') classId: string) {
    const awards = await this.prisma.gameMedalAward.findMany({
      where: { classId },
      select: { userId: true },
      distinct: ['userId'],
    });
    return { userIds: awards.map((a) => a.userId) };
  }

  @Get(':classId/my-stats')
  @ApiOperation({ summary: 'Get caller\'s stats and medal progress in this class' })
  async getMyStats(
    @Param('classId') classId: string,
    @CurrentUser() user: userPayload,
  ) {
    const stats = await this.prisma.gameClassStats.findUnique({
      where: { classId_userId: { classId, userId: user.id } },
    });

    const allMedals = await this.prisma.gameMedal.findMany();
    const myAwards = await this.prisma.gameMedalAward.findMany({
      where: { userId: user.id, classId },
      include: { medal: true },
    });
    const earnedKeys = new Set(myAwards.map((a) => a.medal.key));

    const earned = myAwards.map((a) => ({
      key: a.medal.key,
      name: a.medal.name,
      icon: a.medal.icon,
      awardedAt: a.awardedAt,
    }));

    // Progress toward unearned medals
    const progress = allMedals
      .filter((m) => !earnedKeys.has(m.key))
      .map((m) => this.computeProgress(m.key, stats))
      .filter(Boolean);

    return {
      stats: stats ?? null,
      earned,
      progress,
    };
  }

  @Get(':classId/medals/:userId')
  @ApiOperation({ summary: 'Get a student\'s medals in this class' })
  async getUserMedals(
    @Param('classId') classId: string,
    @Param('userId') userId: string,
  ) {
    const awards = await this.prisma.gameMedalAward.findMany({
      where: { userId, classId },
      include: { medal: true },
      orderBy: { awardedAt: 'asc' },
    });
    return awards.map((a) => ({
      key: a.medal.key,
      category: a.medal.category,
      name: a.medal.name,
      description: a.medal.description,
      icon: a.medal.icon,
      awardedAt: a.awardedAt,
    }));
  }

  private computeProgress(
    key: string,
    stats: { totalWins: number; totalGames: number; consecutiveWins: number; maxConsecWins: number } | null,
  ) {
    if (!stats) return null;
    const map: Record<string, { current: number; target: number }> = {
      WINS_3:        { current: stats.totalWins,    target: 3 },
      WINS_10:       { current: stats.totalWins,    target: 10 },
      WINS_50:       { current: stats.totalWins,    target: 50 },
      WINS_100:      { current: stats.totalWins,    target: 100 },
      CONSEC_WIN_3:  { current: stats.maxConsecWins, target: 3 },
      CONSEC_WIN_5:  { current: stats.maxConsecWins, target: 5 },
      CONSEC_WIN_10: { current: stats.maxConsecWins, target: 10 },
      GAMES_10:      { current: stats.totalGames,   target: 10 },
      GAMES_50:      { current: stats.totalGames,   target: 50 },
      GAMES_100:     { current: stats.totalGames,   target: 100 },
    };
    const entry = map[key];
    if (!entry) return null;
    return {
      medalKey: key,
      current: entry.current,
      target: entry.target,
      pct: Math.min(100, Math.round((entry.current / entry.target) * 100)),
    };
  }
}
