import {
  BadGatewayException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VariantService } from './variant.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { createVariantDto } from './dto/create-variant-dto';
import {
  updateVariantDto,
  updateVariantParamDto,
} from './dto/update-variant-dto';
import { stockMovementDto } from './dto/stock-movment.dto';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';

@Controller('variants')
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  @Post('/')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand', 'BRAND_ADMIN')
  async createVariant(
    @Body() dto: createVariantDto,
    @getCurrentUser() user: AuthUser,
  ) {
    const variant = await this.variantService.createVariant(
      dto,
      user.brandId,
      user.role === 'admin',
    );
    if (!variant) throw new BadGatewayException('Variant not created');
    return {
      success: true,
      message: 'Variant created successfully',
      data: variant,
    };
  }

  @Patch('/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand', 'BRAND_ADMIN')
  async updateVariant(
    @Body() dto: updateVariantDto,
    @Param('id') id: string,
    @getCurrentUser() user: AuthUser,
  ) {
    const updateVariant = await this.variantService.updateVariantById(
      id,
      dto,
      user.brandId,
      user.role === 'admin',
    );
    if (!updateVariant) throw new BadGatewayException('variant not updated');

    return {
      success: true,
      message: 'variant updated successfully',
      data: updateVariant,
    };
  }

  @Delete('/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand', 'BRAND_ADMIN')
  async softDeleteVariant(
    @Param('id') id: string,
    @getCurrentUser() user: AuthUser,
  ) {
    await this.variantService.softDeleteVariantById(
      id,
      user.brandId,
      user.role === 'admin',
    );
    return { success: true, message: 'Variant deleted successfully' };
  }

  @Post('/:id/stock-movement')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand', 'BRAND_ADMIN')
  async stockMovement(
    @Body() dto: stockMovementDto,
    @Param('id') id: string,
    @getCurrentUser() user: AuthUser,
  ) {
    const variant = await this.variantService.getVariantByid(
      id,
      user.brandId,
      user.role === 'admin',
    );
    if (!variant) throw new NotFoundException('variant not found');

    const handeledData = {
      stock:
        dto.movmentType === 'in'
          ? {
              increment: dto.quantity,
            }
          : {
              decrement: dto.quantity,
            },
    };

    const updateVariant = await this.variantService.updateVariant(
      id,
      handeledData,
      user.brandId,
      user.role === 'admin',
    );
    if (!updateVariant) throw new BadGatewayException('variant not updated');
    return {
      success: true,
      message: `variant Stock of ${dto.quantity} ${dto.movmentType === 'in' ? 'added' : 'removed'} successfully`,
      data: updateVariant,
    };
  }

  @Get('/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand', 'BRAND_ADMIN')
  async getVariant(@Param('id') id: string, @getCurrentUser() user: AuthUser) {
    const variant = await this.variantService.getVariantByid(
      id,
      user.brandId,
      user.role === 'admin',
    );
    if (!variant) throw new NotFoundException('variant not found');
    return {
      success: true,
      message: 'variant fetched successfully',
      data: variant,
    };
  }
}
