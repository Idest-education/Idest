import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { GradeService } from './grade.service';
import { GradeController } from './grade.controller';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    ConfigModule,
  ],
  providers: [GradeService, JwtAuthGuard],
  controllers: [GradeController],
  exports: [GradeService],
})
export class GradeModule {}
