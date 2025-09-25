import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { WritingService } from './writing.service';
import { WritingController } from './writing.controller';
import { Assignment, AssignmentSchema } from '../schemas/assignment.schema';
import { WritingSubmission, WritingSubmissionSchema } from './schemas/writing-submission.schema';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assignment.name, schema: AssignmentSchema },
      { name: WritingSubmission.name, schema: WritingSubmissionSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [WritingController],
  providers: [WritingService, JwtAuthGuard],
})
export class WritingModule {}


