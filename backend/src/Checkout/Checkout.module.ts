import { Module } from '@nestjs/common';
import { CheckoutController } from './Checkout.controller';
import { CheckoutService } from './Checkout.service';
import { CartModule } from '../Cart/cart.module';
import { VariantModule } from '../Variants/variant.module';
import { BrandBranchModule } from '../BrandBranch/brandBranch.module';

@Module({
  exports: [],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  imports: [CartModule, VariantModule , BrandBranchModule],
})
export class CheckoutModule {}
