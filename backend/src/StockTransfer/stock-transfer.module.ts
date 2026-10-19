import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { TokenModule } from '../utils/Token/token.module';
import { StockLedgerModule } from '../StockLedger/stock-ledger.module';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';

@Module({
  imports: [PrismaModule, TokenModule, StockLedgerModule],
  controllers: [StockTransferController],
  providers: [AuthGuard, RolesGuard, StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
