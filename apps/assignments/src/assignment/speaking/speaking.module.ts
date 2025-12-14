import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { SpeakingService } from './speaking.service';
import { SpeakingController } from './speaking.controller';
import { SpeakingAssignment, SpeakingAssignmentSchema } from '../schemas/speaking-assignment.schema';
import { SpeakingResponse, SpeakingResponseSchema } from './schemas/speaking-response.schema';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { GradeModule } from '../../grade/grade.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { RabbitModule } from '../../rabbit/rabbit.module';

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
    forwardRef(() => GradeModule),
    SupabaseModule,
    RabbitModule,
  ],
  controllers: [SpeakingController],
  providers: [SpeakingService, JwtAuthGuard],
  exports: [SpeakingService],
})
export class SpeakingModule {}


