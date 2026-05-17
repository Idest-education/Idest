import { Module, forwardRef } from '@nestjs/common';
import { GradeService } from './grade.service';
import { RabbitModule } from '../rabbit/rabbit.module';
import { ReadingModule } from '../assignment/reading/reading.module';
import { ListeningModule } from '../assignment/listening/listening.module';
import { WritingModule } from '../assignment/writing/writing.module';

@Module({
  imports: [
    RabbitModule,
    ReadingModule,
    ListeningModule,
    forwardRef(() => WritingModule),
  ],
  providers: [GradeService],
  exports: [GradeService],
})
export class GradeModule {}
