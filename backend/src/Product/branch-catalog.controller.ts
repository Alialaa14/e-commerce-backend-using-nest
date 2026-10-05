import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CatalogService } from './catalog.service';
import {
  CopyOfferingsDto,
  CreateBranchOfferingDto,
  UpdateBranchOfferingDto,
} from './dto/branch-offering.dto';
import { CreateCatalogProductDto } from './dto/create-catalog-product.dto';

@Controller('branches/:branchId')
@UseGuards(AuthGuard, RolesGuard, BranchScopeGuard)
@Roles('BRANCH_MANAGER')
export class BranchCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('variants')
  async startSellingVariant(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateBranchOfferingDto,
  ) {
    return {
      success: true,
      message: 'Variant offering created successfully',
      data: await this.catalogService.createBranchOffer(
        branchId,
        dto.variantId,
        dto,
      ),
    };
  }

  @Patch('variants/:variantId')
  async updateOffering(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateBranchOfferingDto,
  ) {
    return {
      success: true,
      message: 'Branch offering updated successfully',
      data: await this.catalogService.updateBranchOffer(
        branchId,
        variantId,
        dto,
      ),
    };
  }

  @Post('products')
  async createBranchProduct(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateCatalogProductDto,
  ) {
    return {
      success: true,
      message: 'Branch product submitted for approval',
      data: await this.catalogService.createBranchProduct(branchId, dto),
    };
  }

  @Post('copy-offerings')
  async copyOfferings(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CopyOfferingsDto,
  ) {
    return {
      success: true,
      message: 'Branch offerings copied successfully',
      data: await this.catalogService.copyOfferings(branchId, dto),
    };
  }
}
