import { Body, Controller, Post } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}
  @Post()
  checkout(@Body() body: any) {
    return this.checkoutService.createCheckout(body.userId);
  }
}
