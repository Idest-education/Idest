import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ReadingAssignment, ReadingAssignmentSchema } from './schemas/reading-assignment.schema';
import { ListeningAssignment, ListeningAssignmentSchema } from './schemas/listening-assignment.schema';
import { WritingAssignment, WritingAssignmentSchema } from './schemas/writing-assignment.schema';
import { SpeakingAssignment, SpeakingAssignmentSchema } from './schemas/speaking-assignment.schema';
import { ReadingSubmission, ReadingSubmissionSchema } from './schemas/reading-submission.schema';
import { ListeningSubmission, ListeningSubmissionSchema } from './schemas/listening-submission.schema';
import { WritingSubmission, WritingSubmissionSchema } from './writing/schemas/writing-submission.schema';
import { SpeakingSubmission, SpeakingSubmissionSchema } from './speaking/schemas/speaking-submission.schema';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';
import { ReadingModule } from './reading/reading.module';
import { ListeningModule } from './listening/listening.module';
import { WritingModule } from './writing/writing.module';
import { SpeakingModule } from './speaking/speaking.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReadingAssignment.name, schema: ReadingAssignmentSchema },
      { name: ListeningAssignment.name, schema: ListeningAssignmentSchema },
      { name: WritingAssignment.name, schema: WritingAssignmentSchema },
      { name: SpeakingAssignment.name, schema: SpeakingAssignmentSchema },
      { name: ReadingSubmission.name, schema: ReadingSubmissionSchema },
      { name: ListeningSubmission.name, schema: ListeningSubmissionSchema },
      { name: WritingSubmission.name, schema: WritingSubmissionSchema },
      { name: SpeakingSubmission.name, schema: SpeakingSubmissionSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    ReadingModule,
    ListeningModule,
    WritingModule,
    SpeakingModule,
  ],
  controllers: [AssignmentController],
  providers: [JwtAuthGuard, AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
