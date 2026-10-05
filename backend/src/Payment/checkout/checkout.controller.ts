import { Body, Controller, Post } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { getCurrentUser } from '../../common/decorators/Current-user-decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  checkout(@getCurrentUser() user: { sub: string }) {
    console.log(user.sub);
    return this.checkoutService.createCheckout(user.sub);
  }
}
