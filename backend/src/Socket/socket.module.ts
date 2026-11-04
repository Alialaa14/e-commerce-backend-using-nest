import { Module } from '@nestjs/common';
import { SocketServices } from './socket.service';
import { TokenModule } from '../utils/Token/token.module';
import { UserModule } from '../User/user.module';
import { OrderGatewayModule } from './orderGateway/order.gateway.module';
import { PrismaModule } from '../utils/prisma/prisma.module';

@Module({
  exports: [SocketServices],
  imports: [TokenModule, UserModule, OrderGatewayModule, PrismaModule],
  providers: [SocketServices],
  controllers: [],
})
export class SocketModule {}
