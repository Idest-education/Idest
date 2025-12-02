import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { StripeWebhookController } from './stripe.webhook.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [StripeService],
  controllers: [StripeController, StripeWebhookController],
  exports: [StripeService],
})
export class StripeModule {}

