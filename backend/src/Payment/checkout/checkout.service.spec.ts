import { CheckoutStatus } from '../../generated/prisma';
import { CheckoutService } from './checkout.service';

describe('PaymentCheckoutService.createCheckout', () => {
  function createService(
    checkoutTotal: number,
    createStripeSession = jest.fn().mockResolvedValue({ id: 'stripe-1' }),
  ) {
    const service = new CheckoutService(
      {
        checkout: {
          sessions: { create: createStripeSession },
        },
      } as never,
      {
        prisma: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              email: 'customer@example.com',
            }),
          },
          checkoutSession: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'checkout-1',
              total: checkoutTotal,
              status: CheckoutStatus.ready,
              expiresAt: new Date(Date.now() + 60_000),
              addressText: 'Test address',
              phoneNumber: '+201000000000',
              snapshot: {
                items: [
                  {
                    variantId: 'variant-1',
                    name: 'Shirt',
                    color: 'Blue',
                    size: 'M',
                    quantity: 2,
                    price: 50,
                  },
                  {
                    variantId: 'variant-2',
                    name: 'Pants',
                    color: 'Black',
                    size: 'L',
                    quantity: 1,
                    price: 50,
                  },
                ],
                subtotal: 150,
                totalPrice: 135,
                shipments: [
                  {
                    branchId: 'branch-1',
                    variants: [{ variantId: 'variant-1', quantity: 2 }],
                    shipmentDetails: { fee: 5 },
                  },
                  {
                    branchId: 'branch-2',
                    variants: [{ variantId: 'variant-2', quantity: 1 }],
                    shipmentDetails: { fee: 5 },
                  },
                ],
                deliveryFee: 10,
                total: 145,
              },
            }),
          },
        },
      } as never,
    );
    return { service, createStripeSession };
  }

  it('creates Stripe line items from session products and shipment fees', async () => {
    const createStripeSession = jest.fn().mockResolvedValue({ id: 'stripe-1' });
    const { service } = createService(145, createStripeSession);

    await service.createCheckout('user-1');

    expect(createStripeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'customer@example.com',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'egp',
              unit_amount: 9_000,
              product_data: {
                name: 'Shirt',
                description: 'Blue / M / Quantity: 2',
                metadata: { variantId: 'variant-1' },
              },
            },
          },
          {
            quantity: 1,
            price_data: {
              currency: 'egp',
              unit_amount: 4_500,
              product_data: {
                name: 'Pants',
                description: 'Black / L / Quantity: 1',
                metadata: { variantId: 'variant-2' },
              },
            },
          },
          {
            quantity: 1,
            price_data: {
              currency: 'egp',
              unit_amount: 500,
              product_data: {
                name: 'Delivery fee',
                description: 'Delivery fee for branch branch-1',
              },
            },
          },
          {
            quantity: 1,
            price_data: {
              currency: 'egp',
              unit_amount: 500,
              product_data: {
                name: 'Delivery fee',
                description: 'Delivery fee for branch branch-2',
              },
            },
          },
        ],
        metadata: {
          checkoutId: 'checkout-1',
          userId: 'user-1',
        },
        payment_method_types: ['card'],
      }),
    );
  });

  it('rejects a mismatch between the saved total and its snapshot', async () => {
    const { service, createStripeSession } = createService(146);

    await expect(service.createCheckout('user-1')).rejects.toThrow(
      'Checkout snapshot is incomplete',
    );

    expect(createStripeSession).not.toHaveBeenCalled();
  });
});
