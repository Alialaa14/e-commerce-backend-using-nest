import { Module } from '@nestjs/common';
import { VariantModule } from '../Variants/variant.module';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { TokenModule } from '../utils/Token/token.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartModel } from './cart.model';
@Module({
  exports: [],
  imports: [VariantModule, PrismaModule, TokenModule],
  controllers: [CartController],
  providers: [CartService, CartModel],
})
export class CartModule {}
