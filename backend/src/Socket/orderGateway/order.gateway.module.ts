import { Module } from '@nestjs/common';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { OrderModel } from './order.model';
import { OrderGatewayServices } from './order.gatway.service';

@Module({
  imports: [PrismaModule],
  providers: [OrderGatewayServices, OrderModel],
  exports: [OrderModel],
})
export class OrderGatewayModule {}
