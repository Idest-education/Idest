import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ListeningService } from './listening.service';
import { ListeningController } from './listening.controller';
import { ListeningAssignment, ListeningAssignmentSchema } from '../schemas/listening-assignment.schema';
import { ListeningSubmission, ListeningSubmissionSchema } from '../schemas/listening-submission.schema';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ListeningAssignment.name, schema: ListeningAssignmentSchema },
      { name: ListeningSubmission.name, schema: ListeningSubmissionSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [ListeningController],
  providers: [ListeningService, JwtAuthGuard],
  exports: [ListeningService],
})
export class ListeningModule {}
