import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MeetModule } from './meet/meet.module';

@Module({
  imports: [UserModule, PrismaModule, UserModule, CloudinaryModule, MeetModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
