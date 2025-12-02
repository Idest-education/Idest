import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    // Use Stripe's default API version from the installed SDK
    this.stripe = new Stripe(secretKey);
  }

  async createClassPaymentIntent(userId: string, classId: string) {
    try {
      const classData = (await this.prisma.class.findUnique({
        where: { id: classId },
      })) as any;

      if (!classData) {
        throw new BadRequestException('Class not found');
      }

      if (classData.price == null) {
        // Free class, no payment required
        return { isFree: true };
      }

      const user = (await this.prisma.user.findUnique({
        where: { id: userId },
      })) as any;

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.purchases?.includes(classData.id)) {
        return { alreadyOwned: true };
      }

      const currency = (classData.currency || 'vnd').toLowerCase();

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: classData.price,
        currency,
        metadata: {
          userId,
          classId: classData.id,
        },
        receipt_email: user.email ?? undefined,
      });

      return {
        isFree: false,
        alreadyOwned: false,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      console.error('Error creating class payment intent:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create payment intent');
    }
  }

  /**
   * Create a Stripe Checkout Session for purchasing a class.
   */
  async createClassCheckoutSession(userId: string, classId: string) {
    try {
      const classData = (await this.prisma.class.findUnique({
        where: { id: classId },
      })) as any;

      if (!classData) {
        throw new BadRequestException('Class not found');
      }

      const user = (await this.prisma.user.findUnique({
        where: { id: userId },
      })) as any;

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (Array.isArray(user.purchases) && user.purchases.includes(classId)) {
        return { alreadyOwned: true };
      }

      // Free class: enroll immediately
      if (classData.price == null) {
        await this.recordPurchaseAndEnrollment(userId, classId);
        return { isFree: true };
      }

      const frontendBase = this.configService.get<string>('FRONTEND_BASE_URL');
      if (!frontendBase) {
        throw new InternalServerErrorException('FRONTEND_BASE_URL is not configured');
      }

      const currency = (classData.currency || 'vnd').toLowerCase();

      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              unit_amount: classData.price,
              product_data: {
                name: classData.name,
                description: classData.description,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${frontendBase}/?checkout=success&classId=${classId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendBase}/?checkout=cancel&classId=${classId}`,
        metadata: {
          userId,
          classId,
        },
      });

      return {
        isFree: false,
        alreadyOwned: false,
        url: session.url,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create checkout session');
    }
  }

  async confirmClassPurchase(
    userId: string,
    classId: string,
    paymentIntentId?: string,
  ) {
    try {
      const classData = (await this.prisma.class.findUnique({
        where: { id: classId },
      })) as any;

      if (!classData) {
        throw new BadRequestException('Class not found');
      }

      // For free classes we don't hit Stripe, just record purchase + enrollment
      if (classData.price == null) {
        await this.recordPurchaseAndEnrollment(userId, classId);
        return { success: true, isFree: true };
      }

      if (!paymentIntentId) {
        throw new BadRequestException('paymentIntentId is required for paid classes');
      }

      const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (pi.status !== 'succeeded') {
        throw new BadRequestException('Payment is not completed');
      }

      const metaUserId = (pi.metadata?.userId as string) || null;
      const metaClassId = (pi.metadata?.classId as string) || null;

      if (metaUserId !== userId || metaClassId !== classId) {
        throw new BadRequestException('Payment metadata does not match user/class');
      }

      const currency = (classData.currency || 'vnd').toLowerCase();
      if (pi.currency.toLowerCase() !== currency) {
        throw new BadRequestException('Currency mismatch');
      }

      if (pi.amount !== classData.price) {
        throw new BadRequestException('Amount mismatch');
      }

      await this.recordPurchaseAndEnrollment(userId, classId);

      return { success: true, isFree: false };
    } catch (error) {
      console.error('Error confirming class purchase:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to confirm class purchase');
    }
  }

  private async recordPurchaseAndEnrollment(userId: string, classId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Ensure membership
      const existingMember = await tx.classMember.findFirst({
        where: { class_id: classId, student_id: userId },
      });

      if (!existingMember) {
        await tx.classMember.create({
          data: {
            class_id: classId,
            student_id: userId,
            status: 'active',
          },
        });
      }

      // Ensure purchase recorded in user.purchases array
      const user = (await tx.user.findUnique({
        where: { id: userId },
      })) as any;

      if (user) {
        const currentPurchases = user.purchases || [];
        if (!currentPurchases.includes(classId)) {
          // Cast to any to avoid type mismatches when Prisma client types
          // have not yet been regenerated for new schema fields.
          await (tx.user.update as any)({
            where: { id: userId },
            data: {
              purchases: {
                set: [...currentPurchases, classId],
              },
            },
          });
        }
      }
    });
  }
}


