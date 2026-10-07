import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../utils/prisma/prisma.service';
import type { AuthUser } from '../decorators/Current-user-decorator';
import { isUUID } from 'class-validator';

@Injectable()
export class BranchScopeGuard implements CanActivate {
  constructor(private readonly prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params?: { branchId?: string };
      user?: AuthUser;
    }>();
    const branchId = request.params?.branchId;
    const user = request.user;

    if (!branchId || !isUUID(branchId) || !user) {
      throw new NotFoundException('Branch not found');
    }

    let where: {
      id: string;
      deletedAt: null;
      isActive: true;
      brandId?: string;
    };
    if (user.role === 'BRANCH_MANAGER') {
      if (user.branchId !== branchId) {
        throw new NotFoundException('Branch not found');
      }
      where = { id: branchId, deletedAt: null, isActive: true };
    } else if (user.role === 'BRAND_ADMIN' || user.role === 'brand') {
      if (!user.brandId) {
        throw new NotFoundException('Branch not found');
      }
      where = {
        id: branchId,
        brandId: user.brandId,
        deletedAt: null,
        isActive: true,
      };
    } else {
      throw new NotFoundException('Branch not found');
    }

    const branch = await this.prismaService.prisma.brandBranch.findFirst({
      where,
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return true;
  }
}
