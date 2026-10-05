import { Module } from '@nestjs/common';
import { StripeModule } from '../stripe/stripe.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { TokenModule } from '../../utils/Token/token.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
@Module({
  controllers: [CustomerController],
  providers: [CustomerService, AuthGuard, RolesGuard],
  exports: [],
  imports: [StripeModule, PrismaModule, TokenModule],
})
export class CustomerModule {}
