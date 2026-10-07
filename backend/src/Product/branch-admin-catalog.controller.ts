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
import { CatalogService } from './catalog.service';

@Controller('branches')
@UseGuards(AuthGuard, RolesGuard)
@Roles('BRAND_ADMIN', 'brand')
export class BranchAdminCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Delete(':branchId')
  async softDelete(
    @getCurrentUser() user: AuthUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    await this.catalogService.softDeleteBranch(user.brandId, branchId);
    return { success: true, message: 'Branch deleted successfully' };
  }
}
