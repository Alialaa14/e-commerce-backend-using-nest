import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BrandModule } from './Brand/brand.module';
import { CategoryModule } from './Category/category.module';
import { UserModule } from './User/user.module';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { BullModule } from '@nestjs/bullmq';
import { ProductModule } from './Product/product.module';
import { VariantModule } from './Variants/variant.module';
import { CartModule } from './Cart/cart.module';
import { PaymentModule } from './Payment/payment.module';
import { WebhookModule } from './webhooks/webhook.module';
import { StripeModule } from './Payment/stripe/stripe.module';
import { LocationModule } from './Location/location.module';
import { StockTransferModule } from './StockTransfer/stock-transfer.module';
import { RedisModule } from './Redis/redis.module';
import { SocketModule } from './Socket/socket.module';
import { StaffModule } from './Staff/staff.module';
import { InventoryModule } from './Inventory/inventory.module';
import { VariantReservationModule } from './VariantReservation/Reservation.module';
import { CheckoutModule } from './Checkout/Checkout.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: new KeyvRedis({ url: configService.get<string>('REDIS_URL') }),
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
    }),
    RedisModule,
    UserModule,
    BrandModule,
    CategoryModule,
    ProductModule,
    VariantModule,
    CartModule,
    PaymentModule,
    StripeModule,
    WebhookModule,
    LocationModule,
    StockTransferModule,
    SocketModule,
    StaffModule,
    InventoryModule,
    VariantReservationModule,
    CheckoutModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
