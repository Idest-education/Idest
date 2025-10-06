import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, HttpModule, ConfigModule],
  providers: [AssignmentService],
  controllers: [AssignmentController],
})
export class AssignmentModule {}
