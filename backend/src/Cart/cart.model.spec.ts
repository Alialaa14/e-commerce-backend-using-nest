import { CartModel } from './cart.model';

describe('CartModel.getCartByUserId', () => {
  it('loads cart products without selecting removed variant stock', async () => {
    const cart = { id: 'cart-1', products: [] };
    type CartQuery = {
      where: { userId: string };
      select: {
        products: {
          select: {
            variant: { select: { stock?: boolean } };
          };
        };
      };
    };
    let query: CartQuery | undefined;
    const findFirst = jest.fn((input: CartQuery) => {
      query = input;
      return Promise.resolve(cart);
    });
    const model = new CartModel({
      prisma: { cart: { findFirst } },
    } as never);

    await expect(model.getCartByUserId('user-1')).resolves.toBe(cart);

    expect(query?.where).toEqual({ userId: 'user-1' });
    expect(query?.select.products.select.variant.select).not.toHaveProperty(
      'stock',
    );
  });
});
