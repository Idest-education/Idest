import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { GradeService } from './grade.service';
import { GradeController } from './grade.controller';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RabbitModule } from '../rabbit/rabbit.module';
import { ReadingModule } from '../assignment/reading/reading.module';
import { ListeningModule } from '../assignment/listening/listening.module';
import { WritingModule } from '../assignment/writing/writing.module';
import { SpeakingModule } from '../assignment/speaking/speaking.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    ConfigModule,
    RabbitModule,
    ReadingModule,
    ListeningModule,
    forwardRef(() => WritingModule),
    forwardRef(() => SpeakingModule),
  ],
  providers: [GradeService, JwtAuthGuard],
  controllers: [GradeController],
  exports: [GradeService],
})
export class GradeModule {}
