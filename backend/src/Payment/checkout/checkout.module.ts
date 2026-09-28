import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { StripeModule } from '../stripe/stripe.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
@Module({
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [],
  imports: [StripeModule, PrismaModule],
})
export class CheckoutModule {}
