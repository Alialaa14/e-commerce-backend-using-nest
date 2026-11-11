import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { BranchRole, Role } from '../../generated/prisma';
import { TokenService } from '../../utils/Token/token.service';
import { PrismaService } from '../../utils/prisma/prisma.service';
import type { AuthUser } from '../decorators/Current-user-decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers?: { authorization?: string };
      user?: AuthUser;
    }>();
    const authHeader = req.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const [, token] = authHeader.split(' ');

    if (!token) {
      throw new UnauthorizedException('Missing JWT token');
    }

    const payload = this.tokenService.verifyAccessToken<{
      sub: string;
    }>(token);
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        brandId: true,
        branchId: true,
        isBanned: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }
    if (user.isBanned) {
      throw new ForbiddenException('Account banned');
    }

    if (user.role === Role.BRANCH_MANAGER || user.role === Role.Branch_Sales) {
      if (!user.branchId || !user.brandId) {
        throw new ForbiddenException('Branch staff scope is missing');
      }

      const membership = await this.prismaService.prisma.branchStaff.findUnique(
        {
          where: {
            branchId_userId: {
              branchId: user.branchId,
              userId: user.id,
            },
          },
          select: {
            isActive: true,
            role: true,
            branch: {
              select: {
                brandId: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
        },
      );

      const expectedBranchRole =
        user.role === Role.BRANCH_MANAGER
          ? BranchRole.manager
          : BranchRole.sales;
      if (
        !membership?.isActive ||
        membership.role !== expectedBranchRole ||
        !membership.branch.isActive ||
        membership.branch.deletedAt ||
        membership.branch.brandId !== user.brandId
      ) {
        throw new ForbiddenException('Active branch staff membership required');
      }
    }

    const authenticatedUser: AuthUser = {
      sub: user.id,
      role: user.role,
      brandId: user.brandId,
      branchId: user.branchId,
    };
    req.user = authenticatedUser;
    return true;
  }
}
