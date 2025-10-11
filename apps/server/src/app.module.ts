import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MeetModule } from './meet/meet.module';
import { ClassModule } from './class/class.module';
import { SessionModule } from './session/session.module';
import { ConversationModule } from './conversation/conversation.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AiModule } from './ai/ai.module';

const isTestEnv = process.env.NODE_ENV === 'dev';
const throttleImports = isTestEnv
  ? []
  : [
      ThrottlerModule.forRoot([
        {
          ttl: 60_000,
          limit: 100,
        },
      ]),
    ];

const throttleProviders = isTestEnv
  ? []
  : ([
      {
        provide: APP_GUARD,
        useClass: ThrottlerGuard,
      },
    ] as const);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...throttleImports,
    UserModule,
    PrismaModule,
    CloudinaryModule,
    MeetModule,
    ClassModule,
    SessionModule,
    ConversationModule,
    SupabaseModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService, ...throttleProviders],
})
export class AppModule {}
