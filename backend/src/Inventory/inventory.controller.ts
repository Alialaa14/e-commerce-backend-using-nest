import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GetBranchInventoryQueryDto } from './dto/get-branch-inventory-query.dto';
import { UpdateBranchVariantStockDto } from './dto/update-branch-variant-stock.dto';
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

  @Get('variants/:variantId')
  async getBranchVariantStock(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return {
      success: true,
      message: 'Variant stock retrieved successfully',
      data: await this.inventoryService.getBranchVariantStock(
        branchId,
        variantId,
      ),
    };
  }

  @Patch('variants/:variantId')
  async setBranchVariantStock(
    @getCurrentUser() user: AuthUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateBranchVariantStockDto,
  ) {
    return {
      success: true,
      message: 'Variant stock updated successfully',
      data: await this.inventoryService.setBranchVariantStock(
        branchId,
        variantId,
        {
          onHand: dto.onHand,
          lowStockThreshold: dto.lowStockThreshold,
        },
        user.sub,
        dto.note,
      ),
    };
  }
}
