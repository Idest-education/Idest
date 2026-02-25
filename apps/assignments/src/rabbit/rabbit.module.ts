import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitService } from './rabbit.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RabbitService],
  exports: [RabbitService],
})
export class RabbitModule {}

