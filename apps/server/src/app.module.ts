import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MeetModule } from './meet/meet.module';
import { ClassModule } from './class/class.module';
import { SessionModule } from './session/session.module';
import { ConversationModule } from './conversation/conversation.module';

@Module({
  imports: [
    UserModule,
    PrismaModule,
    CloudinaryModule,
    MeetModule,
    ClassModule,
    SessionModule,
    ConversationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
