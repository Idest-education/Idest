import { Module } from '@nestjs/common';
import { GradeController } from './grade.controller';
import { RabbitModule } from 'src/rabbit/rabbit.module';
@Module({
  controllers: [GradeController],
  imports: [RabbitModule],
})
export class GradeModule {}
