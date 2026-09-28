import { Module } from '@nestjs/common';
import { StripeModule } from '../stripe/stripe.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { TokenModule } from '../../utils/Token/token.module';
@Module({
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [],
  imports: [StripeModule, PrismaModule, TokenModule],
})
export class CustomerModule {}
