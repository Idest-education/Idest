import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { SpeakingService } from './speaking.service';
import { SpeakingController } from './speaking.controller';
import { SpeakingAssignment, SpeakingAssignmentSchema } from '../schemas/speaking-assignment.schema';
import { SpeakingResponse, SpeakingResponseSchema } from './schemas/speaking-response.schema';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { GradeModule } from '../../grade/grade.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SpeakingAssignment.name, schema: SpeakingAssignmentSchema },
      { name: SpeakingResponse.name, schema: SpeakingResponseSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    GradeModule,
  ],
  controllers: [SpeakingController],
  providers: [SpeakingService, JwtAuthGuard],
})
export class SpeakingModule {}


