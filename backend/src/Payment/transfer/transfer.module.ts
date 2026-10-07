import { Module } from '@nestjs/common';
import { TokenModule } from '../../utils/Token/token.module';
import { StripeModule } from '../stripe/stripe.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [TokenModule, StripeModule, PrismaModule],
  controllers: [TransferController],
  providers: [TransferService, AuthGuard, RolesGuard],
  exports: [],
})
export class TransferModule {}
