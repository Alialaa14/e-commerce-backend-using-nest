import { Module } from '@nestjs/common';
import { CheckoutController } from './Checkout.controller';
import { CheckoutService } from './Checkout.service';
import { CartModule } from '../Cart/cart.module';
import { VariantModule } from '../Variants/variant.module';
import { BrandBranchModule } from '../BrandBranch/brandBranch.module';
import { InventoryModule } from '../Inventory/inventory.module';
import { CheckoutModule as StripeCheckoutModule } from '../Payment/checkout/checkout.module';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { TokenModule } from '../utils/Token/token.module';
import { SocketModule } from '../Socket/socket.module';

@Module({
  exports: [CheckoutService],
  controllers: [CheckoutController],
  providers: [CheckoutService, AuthGuard, RolesGuard],
  imports: [
    CartModule,
    VariantModule,
    BrandBranchModule,
    InventoryModule,
    StripeCheckoutModule,
    PrismaModule,
    TokenModule,
    SocketModule,
  ],
})
export class CheckoutModule {}
