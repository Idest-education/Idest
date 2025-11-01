import { Module } from '@nestjs/common';
import { MeetService } from './meet.service';
import { MeetGateway } from './meet.gateway';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { ConnectedUsersManager } from './utils/connected-users-manager';

@Module({
  imports: [PrismaModule, UserModule],
  providers: [MeetService, MeetGateway, ConnectedUsersManager],
  exports: [MeetService, ConnectedUsersManager],
})
export class MeetModule {}
