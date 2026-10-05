import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { BranchScopeGuard } from './branch-scope.guard';

describe('BranchScopeGuard', () => {
  it('hides branches outside a branch manager assignment with 404', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { branchId: '00000000-0000-4000-8000-000000000002' },
          user: {
            sub: 'manager-1',
            role: 'BRANCH_MANAGER',
            branchId: '00000000-0000-4000-8000-000000000001',
            brandId: '00000000-0000-4000-8000-000000000003',
          },
        }),
      }),
    } as ExecutionContext;
    const prismaService = {
      prisma: { brandBranch: { findFirst: jest.fn() } },
    } as unknown as PrismaService;
    const guard = new BranchScopeGuard(prismaService);

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    expect(prismaService.prisma.brandBranch.findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 for malformed branch ids without querying Prisma', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { branchId: 'not-a-uuid' },
          user: {
            sub: 'manager-1',
            role: 'BRANCH_MANAGER',
            branchId: '00000000-0000-4000-8000-000000000001',
            brandId: '00000000-0000-4000-8000-000000000003',
          },
        }),
      }),
    } as ExecutionContext;
    const prismaService = {
      prisma: { brandBranch: { findFirst: jest.fn() } },
    } as unknown as PrismaService;
    const guard = new BranchScopeGuard(prismaService);

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    expect(prismaService.prisma.brandBranch.findFirst).not.toHaveBeenCalled();
  });
});
