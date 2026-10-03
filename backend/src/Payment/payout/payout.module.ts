import { Module } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TokenModule } from '../../utils/Token/token.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { StripeModule } from '../stripe/stripe.module';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';

@Module({
  imports: [TokenModule, PrismaModule, StripeModule],
  controllers: [PayoutController],
  providers: [PayoutService, AuthGuard, RolesGuard],
})
export class PayoutModule {}
