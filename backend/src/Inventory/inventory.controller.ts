import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GetBranchInventoryQueryDto } from './dto/get-branch-inventory-query.dto';
import { InventoryService } from './inventory.service';

@Controller('branches/:branchId/inventory')
@UseGuards(AuthGuard, RolesGuard, BranchScopeGuard)
@Roles('BRANCH_MANAGER', 'BRAND_ADMIN', 'brandOwner')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getBranchInventory(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() query: GetBranchInventoryQueryDto,
  ) {
    return {
      success: true,
      message: 'Branch inventory retrieved successfully',
      data: await this.inventoryService.getBranchInventory(branchId, query),
    };
  }
}
