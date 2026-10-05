import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AddCatalogVariantsDto } from './dto/add-catalog-variants.dto';
import { CreateCatalogProductDto } from './dto/create-catalog-product.dto';
import { UpdateCatalogProductDto } from './dto/update-catalog-product.dto';
import { CatalogService } from './catalog.service';

@Controller('products')
@UseGuards(AuthGuard, RolesGuard)
@Roles('BRAND_ADMIN', 'brand')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  async create(
    @getCurrentUser() user: AuthUser,
    @Body() dto: CreateCatalogProductDto,
  ) {
    return {
      success: true,
      message: 'Product created successfully',
      data: await this.catalogService.createProduct(user.brandId, dto),
    };
  }

  @Patch(':id')
  async update(
    @getCurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogProductDto,
  ) {
    return {
      success: true,
      message: 'Product updated successfully',
      data: await this.catalogService.updateProduct(user.brandId, id, dto),
    };
  }

  @Delete(':id')
  async remove(
    @getCurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.catalogService.softDeleteProduct(user.brandId, id);
    return { success: true, message: 'Product deleted successfully' };
  }

  @Patch(':id/approve')
  async approve(
    @getCurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      success: true,
      message: 'Product approved successfully',
      data: await this.catalogService.approveProduct(user.brandId, id),
    };
  }

  @Post(':id/variants')
  async addVariants(
    @getCurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCatalogVariantsDto,
  ) {
    return {
      success: true,
      message: 'Product variants created successfully',
      data: await this.catalogService.addVariants(user.brandId, id, dto),
    };
  }
}
