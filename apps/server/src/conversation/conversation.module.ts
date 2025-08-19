import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConversationGateway } from './conversation.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationGateway],
  exports: [ConversationService],
})
export class ConversationModule {}
