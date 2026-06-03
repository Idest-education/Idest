import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GameTemplateController } from './game-template.controller';
import { GameTemplateService } from './game-template.service';
import { GameSessionController } from './game-session.controller';
import { GameSessionService } from './game-session.service';
import { GameGateway } from './game.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [GameTemplateController, GameSessionController],
  providers: [GameTemplateService, GameSessionService, GameGateway],
  exports: [GameSessionService],
})
export class GameModule {}
