import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ReadingService } from './reading.service';
import { ReadingController } from './reading.controller';
import { ReadingAssignment, ReadingAssignmentSchema } from '../schemas/reading-assignment.schema';
import { ReadingSubmission, ReadingSubmissionSchema } from '../schemas/reading-submission.schema';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReadingAssignment.name, schema: ReadingAssignmentSchema },
      { name: ReadingSubmission.name, schema: ReadingSubmissionSchema },
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
