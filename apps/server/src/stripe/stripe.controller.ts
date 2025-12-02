import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { StripeService } from './stripe.service';

class ConfirmPurchaseDto {
  paymentIntentId?: string;
}

@Controller('stripe')
@ApiTags('Stripe')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('classes/:classId/payment-intent')
  @ApiOperation({
    summary: 'Create payment intent for a class',
    description:
      'Creates a Stripe PaymentIntent for purchasing a class in VND. If the class is free or already owned, returns flags instead.',
  })
  @ApiParam({
    name: 'classId',
    description: 'ID of the class to purchase',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Payment intent created or purchase is free/already owned',
  })
  async createClassPaymentIntent(
    @CurrentUser() user: userPayload,
    @Param('classId') classId: string,
  ) {
    return this.stripeService.createClassPaymentIntent(user.id, classId);
  }

  @Post('classes/:classId/confirm')
  @ApiOperation({
    summary: 'Confirm class purchase',
    description:
      'Finalizes a class purchase after Stripe payment succeeds. Also enrolls the user into the class and records the purchase.',
  })
  @ApiParam({
    name: 'classId',
    description: 'ID of the class to confirm purchase for',
    example: 'class-uuid-here',
  })
  @ApiBody({
    type: ConfirmPurchaseDto,
    description:
      'For paid classes, provide the Stripe PaymentIntent ID. For free classes, this body can be empty.',
  })
  @ApiOkResponse({
    description: 'Purchase confirmed and user enrolled (or already had access)',
  })
  async confirmClassPurchase(
    @CurrentUser() user: userPayload,
    @Param('classId') classId: string,
    @Body() body: ConfirmPurchaseDto,
  ) {
    return this.stripeService.confirmClassPurchase(
      user.id,
      classId,
      body.paymentIntentId,
    );
  }
}


