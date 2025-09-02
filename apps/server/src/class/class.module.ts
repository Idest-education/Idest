import { Module } from '@nestjs/common';
import { ClassController } from './class.controller';
import { ClassService } from './class.service';
import { ClassQueryService } from './service/class-query.service';
import { ClassCRUDService } from './service/class-CRUD.service';
import { ClassMembershipService } from './service/class-membership.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SessionModule } from 'src/session/session.module';

@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [ClassController],
  providers: [
    ClassService,
    ClassQueryService,
    ClassCRUDService,
    ClassMembershipService,
  ],
  exports: [ClassService],
})
export class ClassModule {}
