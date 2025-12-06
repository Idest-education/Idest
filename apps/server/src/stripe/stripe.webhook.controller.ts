import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeWebhookController {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') sig: string,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }

    let event: Stripe.Event;
    try {
      // rawBody must be provided by Nest/Express configuration
      const rawBody = (req as any).rawBody || (req as any).bodyRaw;
      event = this.stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Stripe webhook verification failed:', err);
      throw new BadRequestException('Invalid Stripe signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const classId = session.metadata?.classId;

      console.log('Checkout session completed:', {
        sessionId: session.id,
        userId,
        classId,
        paymentStatus: session.payment_status,
      });

      if (userId && classId) {
        try {
          await (this.stripeService as any)['recordPurchaseAndEnrollment'](
            userId,
            classId,
          );
          console.log('Successfully recorded purchase and enrollment:', { userId, classId });
        } catch (error) {
          console.error('Error recording purchase and enrollment:', error);
          throw error;
        }
      } else {
        console.warn('Missing userId or classId in checkout session metadata:', {
          userId,
          classId,
          metadata: session.metadata,
        });
      }
    }

    return { received: true };
  }
}


