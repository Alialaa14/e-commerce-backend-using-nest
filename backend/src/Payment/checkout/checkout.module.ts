import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { StripeModule } from '../stripe/stripe.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { TokenModule } from '../../utils/Token/token.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
@Module({
  controllers: [CheckoutController],
  providers: [CheckoutService, AuthGuard, RolesGuard],
  exports: [],
  imports: [StripeModule, PrismaModule, TokenModule],
})
export class CheckoutModule {}
