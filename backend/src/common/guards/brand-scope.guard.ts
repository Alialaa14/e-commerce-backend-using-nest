import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../decorators/Current-user-decorator';

@Injectable()
export class BrandScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      params?: { brandId?: string };
      user?: AuthUser;
    }>();
    const brandId = request.params?.brandId;
    const user = request.user;

    if (
      !brandId ||
      !user ||
      (user.role !== 'BRAND_ADMIN' && user.role !== 'brand') ||
      user.brandId !== brandId
    ) {
      throw new NotFoundException('Brand not found');
    }

    return true;
  }
}
