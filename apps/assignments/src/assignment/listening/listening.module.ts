import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ListeningService } from './listening.service';
import { ListeningController } from './listening.controller';
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
  controllers: [ListeningController],
  providers: [ListeningService, JwtAuthGuard],
})
export class ListeningModule {}


