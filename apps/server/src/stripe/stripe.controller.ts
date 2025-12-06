import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { StripeService } from './stripe.service';

import { IsNotEmpty, IsString } from 'class-validator';

class VerifyEnrollmentDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

@Controller('stripe')
@ApiTags('Stripe')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('classes/:classId/checkout-session')
  @ApiOperation({
    summary: 'Create Stripe Checkout Session for a class',
    description:
      'Creates a Stripe Checkout Session URL for purchasing a class. If the class is free or already owned, returns flags instead of a URL.',
  })
  @ApiParam({
    name: 'classId',
    description: 'ID of the class to purchase',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Checkout session created or class is free/already owned',
  })
  async createClassCheckoutSession(
    @CurrentUser() user: userPayload,
    @Param('classId') classId: string,
  ) {
    return this.stripeService.createClassCheckoutSession(user.id, classId);
  }

  @Post('classes/:classId/verify-enrollment')
  @ApiOperation({
    summary: 'Verify checkout session and complete enrollment',
    description:
      'Verifies a Stripe checkout session and completes enrollment if payment succeeded. This serves as a fallback if the webhook did not process the payment.',
  })
  @ApiParam({
    name: 'classId',
    description: 'ID of the class to verify enrollment for',
    example: 'class-uuid-here',
  })
  @ApiBody({
    type: VerifyEnrollmentDto,
    description: 'Stripe checkout session ID',
  })
  @ApiOkResponse({
    description: 'Enrollment verified and completed (or already enrolled)',
  })
  async verifyAndCompleteEnrollment(
    @CurrentUser() user: userPayload,
    @Param('classId') classId: string,
    @Body() body: VerifyEnrollmentDto,
  ) {
    return this.stripeService.verifyAndCompleteEnrollment(
      user.id,
      classId,
      body.sessionId,
    );
  }
}


