import { NotFoundException } from '@nestjs/common';
import { ProductModel } from '../Product/product.model';
import { VariantModel } from './variant.model';
import { VariantService } from './variant.service';

describe('VariantService catalog scoping', () => {
  it('hides another brand variant and does not update it', async () => {
    const variantModel = {
      getVariantById: jest.fn().mockResolvedValue({
        id: 'variant-1',
        isDeleted: false,
        deletedAt: null,
        product: {
          id: 'product-1',
          brandId: 'brand-1',
          isDeleted: false,
          deletedAt: null,
        },
      }),
      updateVariant: jest.fn(),
    } as unknown as VariantModel;
    const productModel = {} as ProductModel;
    const service = new VariantService(variantModel, productModel);

    await expect(
      service.updateVariantById('variant-1', { basePrice: 45 }, 'brand-2'),
    ).rejects.toThrow(NotFoundException);
    expect(variantModel.updateVariant).not.toHaveBeenCalled();
  });

  it('does not let a brand create a variant on another brand product', async () => {
    const variantModel = {
      createVariants: jest.fn(),
    } as unknown as VariantModel;
    const productModel = {
      getCatalogProduct: jest.fn().mockResolvedValue({
        id: 'product-1',
        brandId: 'brand-1',
        price: 50,
        variants: [],
      }),
    } as unknown as ProductModel;
    const service = new VariantService(variantModel, productModel);

    await expect(
      service.createVariant(
        {
          productId: 'product-1',
          color: 'red',
          size: 'M',
          stock: 0,
        },
        'brand-2',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(variantModel.createVariants).not.toHaveBeenCalled();
  });
});
