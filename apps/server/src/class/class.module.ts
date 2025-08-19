import { Module } from '@nestjs/common';
import { ClassController } from './class.controller';
import { ClassService } from './class.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SessionModule } from 'src/session/session.module';

@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [ClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
