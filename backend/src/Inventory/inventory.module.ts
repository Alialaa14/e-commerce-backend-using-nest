import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { TokenModule } from '../utils/Token/token.module';
import { StockLedgerModule } from '../StockLedger/stock-ledger.module';

@Module({
  imports: [PrismaModule, TokenModule, StockLedgerModule],
  controllers: [InventoryController],
  providers: [InventoryService, AuthGuard, RolesGuard, BranchScopeGuard],
  exports: [InventoryService],
})
export class InventoryModule {}
