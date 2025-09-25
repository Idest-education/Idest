import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Assignment, AssignmentSchema } from './schemas/assignment.schema';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ReadingModule } from './reading/reading.module';
import { ListeningModule } from './listening/listening.module';
import { WritingModule } from './writing/writing.module';
import { SpeakingModule } from './speaking/speaking.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assignment.name, schema: AssignmentSchema }
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    ReadingModule,
    ListeningModule,
    WritingModule,
    SpeakingModule,
  ],
  controllers: [],
  providers: [JwtAuthGuard],
  exports: [],
})
export class AssignmentModule {}
