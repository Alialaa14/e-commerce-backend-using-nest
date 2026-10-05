import { ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { TokenService } from '../../utils/Token/token.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard tenant context', () => {
  it('loads current role and tenant assignments from the user record', async () => {
    const request = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    const tokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({
        sub: '11111111-1111-4111-8111-111111111111',
        role: 'user',
        brandId: 'stale-brand',
      }),
    } as unknown as TokenService;
    const prismaService = {
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: '11111111-1111-4111-8111-111111111111',
            role: 'BRAND_ADMIN',
            brandId: 'brand-current',
            branchId: null,
            isBanned: false,
          }),
        },
      },
    } as unknown as PrismaService;
    const guard = new AuthGuard(tokenService, prismaService);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', {
      sub: '11111111-1111-4111-8111-111111111111',
      role: 'BRAND_ADMIN',
      brandId: 'brand-current',
      branchId: null,
    });
    expect(prismaService.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111' },
      select: {
        id: true,
        role: true,
        brandId: true,
        branchId: true,
        isBanned: true,
      },
    });
  });
});
