import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
