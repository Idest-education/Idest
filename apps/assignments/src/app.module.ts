import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssignmentModule } from './assignment/assignment.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { GradeModule } from './grade/grade.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({

  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI!), 
    SupabaseModule,
    AssignmentModule, 
    GradeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
