import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { WritingService } from './writing.service';
import { WritingController } from './writing.controller';
import { WritingAssignment, WritingAssignmentSchema } from '../schemas/writing-assignment.schema';
import { WritingSubmission, WritingSubmissionSchema } from './schemas/writing-submission.schema';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { GradeModule } from '../../grade/grade.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WritingAssignment.name, schema: WritingAssignmentSchema },
      { name: WritingSubmission.name, schema: WritingSubmissionSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    forwardRef(() => GradeModule),
  ],
  controllers: [WritingController],
  providers: [WritingService, JwtAuthGuard],
  exports: [WritingService],
})
export class WritingModule {}


