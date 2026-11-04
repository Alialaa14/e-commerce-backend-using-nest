import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { TokenModule } from '../utils/Token/token.module';
import { SocketModule } from '../Socket/socket.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule, TokenModule, SocketModule],
  controllers: [OrderController],
  providers: [OrderService, AuthGuard, RolesGuard],
  exports: [OrderService],
})
export class OrderModule {}
