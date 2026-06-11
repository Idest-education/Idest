import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GameTemplateController } from './game-template.controller';
import { GameTemplateService } from './game-template.service';
import { GameSessionController } from './game-session.controller';
import { GameSessionService } from './game-session.service';
import { GameGateway } from './game.gateway';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { ClassStatsService } from './class-stats.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [GameTemplateController, GameSessionController, AchievementController],
  providers: [GameTemplateService, GameSessionService, GameGateway, AchievementService, ClassStatsService],
  exports: [GameSessionService],
})
export class GameModule {}
