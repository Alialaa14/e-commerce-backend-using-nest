import { PrismaService } from '../utils/prisma/prisma.service';
import { BrandBranchModel } from './brandBranch.model';

describe('BrandBranchModel', () => {
  it('excludes the current branch when checking duplicate coordinates', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prismaService = {
      prisma: {
        brandBranch: { findFirst },
      },
    } as unknown as PrismaService;
    const model = new BrandBranchModel(prismaService);

    await model.getBrandBranchByCondition({
      brandId: 'brand-1',
      latitude: 30.04442,
      longitude: 31.235712,
      excludeId: 'branch-1',
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        brandId: 'brand-1',
        latitude: 30.04442,
        longitude: 31.235712,
        NOT: { id: 'branch-1' },
      },
    });
  });
});
