import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    AuthGuard,
    RolesGuard,
    BranchScopeGuard,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
