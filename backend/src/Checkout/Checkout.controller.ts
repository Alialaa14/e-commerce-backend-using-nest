import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CheckoutService } from './Checkout.service';
import type Stripe from 'stripe';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post(':checkoutId/payment')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  createPaymentSession(
    @Param('checkoutId') checkoutId: string,
    @getCurrentUser() user: { sub: string },
  ): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    return this.checkoutService.createPaymentSession(checkoutId, user.sub);
  }
}
