import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ReadingService } from './reading.service';
import { ReadingController } from './reading.controller';
import { Assignment, AssignmentSchema } from '../schemas/assignment.schema';
import { Submission, SubmissionSchema } from '../schemas/submission.schema';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assignment.name, schema: AssignmentSchema },
      { name: Submission.name, schema: SubmissionSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [ReadingController],
  providers: [ReadingService, JwtAuthGuard],
  exports: [ReadingService],
})
export class ReadingModule {}


