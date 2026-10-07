import { BadRequestException } from '@nestjs/common';
import { CartModel } from './cart.model';
import { CartService } from './cart.service';
import { VariantService } from '../Variants/variant.service';

describe('CartService', () => {
  it('rejects a product from a different brand than the existing cart items', async () => {
    const cartModel = {
      getCartByUserId: jest.fn().mockResolvedValue({
        id: 'cart-1',
        discount: 0,
      }),
      getCartProducts: jest.fn().mockResolvedValue([
        {
          variantId: 'variant-a',
          variant: { product: { brandId: 'brand-a' } },
        },
      ]),
      createCartProduct: jest.fn(),
      updateProductsCartCount: jest.fn(),
      updateCart: jest.fn(),
    } as unknown as CartModel;
    const variantService = {
      getVariant: jest.fn().mockResolvedValue({
        id: 'variant-b',
        isDeleted: false,
        product: {
          id: 'product-b',
          brandId: 'brand-b',
          isDeleted: false,
          price: 100,
        },
      }),
    } as unknown as VariantService;
    const service = new CartService(cartModel, variantService);

    await expect(
      service.addProductToCart('user-1', 'product-b', {
        color: 'blue',
        size: 'M',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(cartModel.createCartProduct).not.toHaveBeenCalled();
    expect(cartModel.updateProductsCartCount).not.toHaveBeenCalled();
  });
});
