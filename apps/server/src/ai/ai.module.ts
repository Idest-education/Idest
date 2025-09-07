import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { UserModule } from 'src/user/user.module';
import { ClassModule } from 'src/class/class.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [UserModule, ClassModule, PrismaModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
