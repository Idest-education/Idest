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
        success_url: `${frontendBase}/checkout/success?classId=${classId}&className=${encodeURIComponent(classData.name)}&session_id={CHECKOUT_SESSION_ID}&price=${classData.price}&currency=${currency}`,
        cancel_url: `${frontendBase}/checkout/cancel?classId=${classId}&className=${encodeURIComponent(classData.name)}`,
        metadata: {
          userId,
          classId,
        },
      });

      // Validate that the session has a URL
      if (!session.url) {
        console.error('Stripe checkout session created but URL is missing:', session);
        throw new InternalServerErrorException('Checkout session created but URL is missing');
      }

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

  /**
   * Verify checkout session and complete enrollment if payment succeeded.
   * This serves as a fallback if the webhook didn't process the payment.
   */
  async verifyAndCompleteEnrollment(
    userId: string,
    classId: string,
    sessionId: string,
  ) {
    try {
      // Verify the session exists and payment succeeded
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        throw new BadRequestException('Payment has not been completed');
      }

      // Verify metadata matches
      const metaUserId = session.metadata?.userId;
      const metaClassId = session.metadata?.classId;

      if (metaUserId !== userId || metaClassId !== classId) {
        throw new BadRequestException('Session metadata does not match');
      }

      // Check if already enrolled
      const user = (await this.prisma.user.findUnique({
        where: { id: userId },
      })) as any;

      if (user && Array.isArray(user.purchases) && user.purchases.includes(classId)) {
        return { success: true, alreadyEnrolled: true };
      }

      // Complete enrollment
      await this.recordPurchaseAndEnrollment(userId, classId);

      return { success: true, alreadyEnrolled: false };
    } catch (error) {
      console.error('Error verifying and completing enrollment:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to verify and complete enrollment');
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


