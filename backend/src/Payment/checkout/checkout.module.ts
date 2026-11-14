import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { StripeModule } from '../stripe/stripe.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { TokenModule } from '../../utils/Token/token.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
@Module({
  controllers: [],
  providers: [CheckoutService, AuthGuard, RolesGuard],
  exports: [CheckoutService],
  imports: [StripeModule, PrismaModule, TokenModule],
})
export class CheckoutModule {}
