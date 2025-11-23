import { Module } from '@nestjs/common';
import { MeetService } from './meet.service';
import { MeetGateway } from './meet.gateway';
import { MeetController } from './meet.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { SessionModule } from 'src/session/session.module';
import { ConnectedUsersManager } from './utils/connected-users-manager';
import { LiveKitService } from './utils/livekit.service';

@Module({
  imports: [PrismaModule, UserModule, SessionModule],
  controllers: [MeetController],
  providers: [MeetService, MeetGateway, ConnectedUsersManager, LiveKitService],
  exports: [MeetService, ConnectedUsersManager, LiveKitService],
})
export class MeetModule {}
