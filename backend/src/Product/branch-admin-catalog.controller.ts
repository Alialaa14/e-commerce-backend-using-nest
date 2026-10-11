import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BrandBranchService } from '../BrandBranch/brandBranch.service';

@Controller('branches')
@UseGuards(AuthGuard, RolesGuard)
@Roles('brandOwner')
export class BranchAdminCatalogController {
  constructor(private readonly brandBranchService: BrandBranchService) {}

  @Delete(':branchId')
  async softDelete(
    @getCurrentUser() user: AuthUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    await this.brandBranchService.deleteBrandBranch({
      brandId: user.brandId,
      branchId,
      userId: user.sub,
    });
    return { success: true, message: 'Branch deleted successfully' };
  }
}
