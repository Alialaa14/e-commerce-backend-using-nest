import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { BrandScopeGuard } from './brand-scope.guard';

describe('BrandScopeGuard', () => {
  it('allows a brandOwner to access their assigned brand', () => {
    const brandId = '00000000-0000-4000-8000-000000000001';
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { brandId },
          user: { role: 'brandOwner', brandId },
        }),
      }),
    } as ExecutionContext;
    const guard = new BrandScopeGuard();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('does not allow a brandOwner to access another brand', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { brandId: '00000000-0000-4000-8000-000000000002' },
          user: {
            role: 'brandOwner',
            brandId: '00000000-0000-4000-8000-000000000001',
          },
        }),
      }),
    } as ExecutionContext;
    const guard = new BrandScopeGuard();

    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
  });
});