import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

import { ReadingAssignment, ReadingAssignmentSchema } from '../assignment/schemas/reading-assignment.schema';
import { ListeningAssignment, ListeningAssignmentSchema } from '../assignment/schemas/listening-assignment.schema';
import { ReadingSubmission, ReadingSubmissionSchema } from '../assignment/schemas/reading-submission.schema';
import { ListeningSubmission, ListeningSubmissionSchema } from '../assignment/schemas/listening-submission.schema';
import { WritingSubmission, WritingSubmissionSchema } from '../assignment/writing/schemas/writing-submission.schema';
import { SpeakingSubmission, SpeakingSubmissionSchema } from '../assignment/speaking/schemas/speaking-submission.schema';

import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReadingAssignment.name, schema: ReadingAssignmentSchema },
      { name: ListeningAssignment.name, schema: ListeningAssignmentSchema },
      { name: ReadingSubmission.name, schema: ReadingSubmissionSchema },
      { name: ListeningSubmission.name, schema: ListeningSubmissionSchema },
      { name: WritingSubmission.name, schema: WritingSubmissionSchema },
      { name: SpeakingSubmission.name, schema: SpeakingSubmissionSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    ConfigModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressService, JwtAuthGuard],
})
export class ProgressModule {}
