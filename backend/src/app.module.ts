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
    UserModule,
    BrandModule,
    CategoryModule,
    ProductModule,
    VariantModule,
    CartModule,
    PaymentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
