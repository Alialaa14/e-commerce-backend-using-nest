import { BadRequestException } from '@nestjs/common';
import { CartModel } from './cart.model';
import { CartService } from './cart.service';
import { VariantService } from '../Variants/variant.service';

describe('CartService', () => {
  it('rejects a product from a different brand than the cart', async () => {
    const cartModel = {
      getCartByUserId: jest.fn().mockResolvedValue({
        id: 'cart-1',
        discount: 0,
        brandId: 'brand-a',
      }),
      getCartProducts: jest.fn().mockResolvedValue([]),
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

  it('rejects a product from a different brand than existing cart items', async () => {
    const cartModel = {
      getCartByUserId: jest.fn().mockResolvedValue({
        id: 'cart-1',
        discount: 0,
        brandId: null,
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
  });

  it('assigns the product brand to an unassigned cart', async () => {
    const cartModel = {
      getCartByUserId: jest.fn().mockResolvedValue({
        id: 'cart-1',
        discount: 0,
        brandId: null,
      }),
      getCartProducts: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ quantity: 1, price: 100 }]),
      setCartBrandIfUnset: jest.fn().mockResolvedValue(1),
      createCartProduct: jest.fn(),
      updateProductsCartCount: jest.fn(),
      updateCart: jest.fn(),
    } as unknown as CartModel;
    const variantService = {
      getVariant: jest.fn().mockResolvedValue({
        id: 'variant-a',
        isDeleted: false,
        product: {
          id: 'product-a',
          brandId: 'brand-a',
          isDeleted: false,
          price: 100,
        },
      }),
    } as unknown as VariantService;
    const service = new CartService(cartModel, variantService);

    await service.addProductToCart('user-1', 'product-a', {
      color: 'blue',
      size: 'M',
    });

    expect(cartModel.setCartBrandIfUnset).toHaveBeenCalledWith(
      'cart-1',
      'brand-a',
    );
    expect(cartModel.updateCart).toHaveBeenCalledWith('cart-1', {
      price: 100,
      totalPrice: 100,
    });
  });

  it('returns an unassigned cart after clearing it', async () => {
    const cartModel = {
      getCartByUserId: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'cart-1',
          brandId: 'brand-a',
          products: [],
        })
        .mockResolvedValueOnce({
          id: 'cart-1',
          brandId: null,
          products: [],
        }),
      clearCart: jest.fn(),
      deleteCartProduct: jest.fn(),
    } as unknown as CartModel;
    const service = new CartService(cartModel, {} as unknown as VariantService);

    const cart = await service.clearCart('user-1');

    expect(cart.brandId).toBeNull();
  });
});
