import { Module } from '@nestjs/common';
import { SocketServices } from './socket.service';
import { TokenModule } from '../utils/Token/token.module';
import { RedisModule } from '../Redis/redis.module';
import { UserModule } from '../User/user.module';
import { OrderGatewayModule } from './orderGateway/order.gateway.module';
import { PrismaModule } from '../utils/prisma/prisma.module';

@Module({
  exports: [],
  imports: [
    TokenModule,
    RedisModule,
    UserModule,
    OrderGatewayModule,
    PrismaModule,
  ],
  providers: [SocketServices],
  controllers: [],
})
export class SocketModule {}
