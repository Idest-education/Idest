import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GameTemplateController } from './template/game-template.controller';
import { GameTemplateService } from './template/game-template.service';
import { GameSessionController } from './session/game-session.controller';
import { GameSessionService } from './session/game-session.service';
import { GameGateway } from './game.gateway';
import { AchievementService } from './achievement/achievement.service';
import { AchievementController } from './achievement/achievement.controller';
import { ClassStatsService } from './stats/class-stats.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [GameTemplateController, GameSessionController, AchievementController],
  providers: [GameTemplateService, GameSessionService, GameGateway, AchievementService, ClassStatsService],
  exports: [GameSessionService],
})
export class GameModule {}
