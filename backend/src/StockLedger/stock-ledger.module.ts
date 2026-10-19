import { Module } from '@nestjs/common';
import { StockLedgerService } from './stock-ledger.service';

@Module({
  providers: [StockLedgerService],
  exports: [StockLedgerService],
})
export class StockLedgerModule {}
