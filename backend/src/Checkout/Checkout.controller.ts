import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CheckoutService } from './Checkout.service';
import type Stripe from 'stripe';
import { CheckoutAddressDto } from './dto/checkout-address.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  checkout(@getCurrentUser() user: { sub: string }) {
    return this.checkoutService.checkout(user.sub);
  }

  @Post(':checkoutId/address')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  setAddress(
    @Param('checkoutId', ParseUUIDPipe) checkoutId: string,
    @getCurrentUser() user: { sub: string },
    @Body() dto: CheckoutAddressDto,
  ) {
    return this.checkoutService.placeLocation(checkoutId, user.sub, dto);
  }

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
