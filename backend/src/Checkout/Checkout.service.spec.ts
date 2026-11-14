jest.mock('../User/user.service', () => ({
  UserService: class UserService {},
}));

import { CheckoutStatus } from '../generated/prisma';
import { buildCartHash } from '../utils/buildHash';
import { CheckoutService } from './Checkout.service';

describe('CheckoutService.placeLocation', () => {
  it('saves every branch shipment into the same checkout session', async () => {
    const products = [
      { variantId: 'variant-1', quantity: 1 },
      { variantId: 'variant-2', quantity: 2 },
    ];
    const cartHash = buildCartHash(products);
    const session = {
      id: 'checkout-1',
      userId: 'user-1',
      brandId: 'brand-1',
      brandBranchId: null,
      cartHash,
      snapshot: {
        items: products,
        totalPrice: 100,
      },
      status: CheckoutStatus.pending,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new CheckoutService(
      {
        getCart: jest.fn().mockResolvedValue({
          products,
          totalPrice: 100,
        }),
      } as never,
      {} as never,
      {
        prisma: {
          user: {
            findUnique: jest.fn().mockResolvedValue({ phone: null }),
          },
          checkoutSession: {
            findFirst: jest.fn().mockResolvedValue(session),
            updateMany,
          },
        },
      } as never,
      {
        getNearestBranches: jest.fn().mockResolvedValue([
          {
            id: 'branch-1',
            brandId: 'brand-1',
            isActive: true,
            latitude: 30,
            longitude: 31,
          },
          {
            id: 'branch-2',
            brandId: 'brand-1',
            isActive: true,
            latitude: 32,
            longitude: 33,
          },
        ]),
        reverseGeocode: jest.fn().mockResolvedValue({
          formattedAddress: 'Test address',
        }),
        getDirections: jest
          .fn()
          .mockResolvedValueOnce({ distance: 2, duration: 1 })
          .mockResolvedValueOnce({ distance: 3, duration: 2 }),
        calculateDeliveryCost: (distance: number, rate: number) =>
          distance * rate,
      } as never,
      {} as never,
      {
        getBranchVariantStock: jest.fn(
          async (branchId: string, variantId: string) => ({
            available:
              (branchId === 'branch-1' && variantId === 'variant-1') ||
              (branchId === 'branch-2' && variantId === 'variant-2')
                ? 5
                : 0,
          }),
        ),
      } as never,
      {} as never,
      {
        notifyOrderCreated: jest.fn(),
        notifyCheckoutPaymentUpdated: jest.fn(),
      } as never,
    );

    await service.placeLocation('checkout-1', 'user-1', {
      latitude: 29,
      longitude: 30,
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'checkout-1',
          userId: 'user-1',
          status: { in: [CheckoutStatus.ready, CheckoutStatus.pending] },
        }),
        data: expect.objectContaining({
          status: CheckoutStatus.ready,
          addressLat: 29,
          addressLng: 30,
          addressText: 'Test address',
          deliveryFee: 10,
          total: 110,
          brandBranchId: null,
          snapshot: expect.objectContaining({
            shipments: expect.arrayContaining([
              expect.objectContaining({
                branchId: 'branch-1',
                variants: [{ variantId: 'variant-1', quantity: 1 }],
              }),
              expect.objectContaining({
                branchId: 'branch-2',
                variants: [{ variantId: 'variant-2', quantity: 2 }],
              }),
            ]),
          }),
        }),
      }),
    );
  });
});

describe('CheckoutService.checkout', () => {
  it('uses the customer default address to prepare checkout automatically', async () => {
    const checkoutSession = {
      id: 'checkout-1',
      userId: 'user-1',
      brandId: 'brand-1',
      status: CheckoutStatus.pending,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const savedAddress = {
      id: 'address-1',
      addressText: '12 Nile Street, Cairo',
      contactPhone: '+201000000000',
      latitude: 30.0444,
      longitude: 31.2357,
    };
    const placeLocation = jest.fn().mockResolvedValue({
      addressText: savedAddress.addressText,
    });
    const service = new CheckoutService(
      {
        getCart: jest.fn().mockResolvedValue({
          brandId: 'brand-1',
          products: [
            {
              variantId: 'variant-1',
              quantity: 1,
              price: 100,
              variant: {
                isActive: true,
                color: 'Blue',
                size: 'M',
                product: { isDeleted: false, name: 'Shirt' },
              },
            },
          ],
          price: 100,
          totalPrice: 100,
          discount: 0,
          userNumber: '+201111111111',
          userLocation: null,
          cartNote: null,
          userId: 'user-1',
        }),
      } as never,
      {
        checkOnVariantAvailability: jest
          .fn()
          .mockResolvedValue({ totalAvailable: 5 }),
      } as never,
      {
        prisma: {
          address: {
            findFirst: jest.fn().mockResolvedValue(savedAddress),
          },
          checkoutSession: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(checkoutSession),
          },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'placeLocation').mockImplementation(placeLocation);

    await service.checkout('user-1');

    expect(placeLocation).toHaveBeenCalledWith(
      'checkout-1',
      'user-1',
      { latitude: 30.0444, longitude: 31.2357 },
      {
        addressText: '12 Nile Street, Cairo',
        phoneNumber: '+201000000000',
      },
    );
  });

  it('keeps the manual address step when the customer has no saved address', async () => {
    const checkoutSession = {
      id: 'checkout-1',
      userId: 'user-1',
      brandId: 'brand-1',
      status: CheckoutStatus.pending,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const service = new CheckoutService(
      {
        getCart: jest.fn().mockResolvedValue({
          brandId: 'brand-1',
          products: [
            {
              variantId: 'variant-1',
              quantity: 1,
              price: 100,
              variant: {
                isActive: true,
                color: 'Blue',
                size: 'M',
                product: { isDeleted: false, name: 'Shirt' },
              },
            },
          ],
          price: 100,
          totalPrice: 100,
          discount: 0,
          userNumber: '+201111111111',
          userLocation: null,
          cartNote: null,
          userId: 'user-1',
        }),
      } as never,
      {
        checkOnVariantAvailability: jest
          .fn()
          .mockResolvedValue({ totalAvailable: 5 }),
      } as never,
      {
        prisma: {
          address: { findFirst: jest.fn().mockResolvedValue(null) },
          checkoutSession: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(checkoutSession),
          },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const placeLocation = jest.spyOn(service, 'placeLocation');

    const result = await service.checkout('user-1');

    expect(result.data.addressRequired).toBe(true);
    expect(result.data.address).toBeNull();
    expect(placeLocation).not.toHaveBeenCalled();
  });
});

describe('CheckoutService.placeOrder', () => {
  const snapshot = {
    items: [
      {
        variantId: 'variant-1',
        name: 'Shirt',
        quantity: 1,
        price: 50,
      },
      {
        variantId: 'variant-2',
        name: 'Pants',
        quantity: 1,
        price: 50,
      },
    ],
    subtotal: 100,
    totalPrice: 90,
    shipments: [
      {
        branchId: 'branch-1',
        variants: [{ variantId: 'variant-1', quantity: 1 }],
        shipmentDetails: { distance: 2, duration: 1, fee: 5 },
      },
      {
        branchId: 'branch-2',
        variants: [{ variantId: 'variant-2', quantity: 1 }],
        shipmentDetails: { distance: 3, duration: 2, fee: 5 },
      },
    ],
    deliveryFee: 10,
    total: 100,
  };

  function createService(
    sessionStatus: CheckoutStatus,
    createOrder = jest.fn().mockResolvedValue({ parentOrderId: 'order-1' }),
  ) {
    const session = {
      id: 'checkout-1',
      userId: 'user-1',
      brandId: 'brand-1',
      status: sessionStatus,
      paymentStatus: 'succeeded',
      snapshot,
      addressText: 'Test address',
      phoneNumber: '+201000000000',
      deliveryFee: 10,
      total: 100,
      timeEstimation: new Date('2026-10-27T00:00:00.000Z'),
    };
    const tx = {
      checkoutSession: {
        findFirst: jest.fn().mockResolvedValue(session),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      parentOrder: {
        findUnique: jest.fn(),
        create: createOrder,
      },
      variant: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'variant-1', sku: 'SKU-1' },
          { id: 'variant-2', sku: 'SKU-2' },
        ]),
      },
    };
    const socketService = {
      notifyOrderCreated: jest.fn(),
      notifyCheckoutPaymentUpdated: jest.fn(),
    };
    const service = new CheckoutService(
      {} as never,
      {} as never,
      {
        prisma: {
          $transaction: jest.fn((callback) => callback(tx)),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      socketService as never,
    );

    return { service, tx, socketService };
  }

  it('creates one parent order with a branch order for every shipment', async () => {
    const createOrder = jest.fn().mockResolvedValue({
      parentOrderId: 'order-1',
      address: 'Test address',
      phoneNumber: '+201000000000',
      branchOrders: [
        {
          branchOrderId: 'branch-order-1',
          brandBranchId: 'branch-1',
          status: 'ordering',
          total: 50,
          orderItems: [],
        },
      ],
    });
    const { service, tx, socketService } = createService(
      CheckoutStatus.payment_pending,
      createOrder,
    );

    await service.placeOrder('checkout-1', 'user-1');

    expect(tx.checkoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'checkout-1',
        userId: 'user-1',
        status: CheckoutStatus.payment_pending,
        paymentStatus: 'succeeded',
      },
      data: { status: CheckoutStatus.placed },
    });
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          checkoutId: 'checkout-1',
          price: 100,
          deliveryPrice: 10,
          totalPrice: 100,
          address: 'Test address',
          phoneNumber: '+201000000000',
          branchOrders: {
            create: expect.arrayContaining([
              expect.objectContaining({
                brandBranchId: 'branch-1',
                deliveryFee: 5,
                discountShare: 5,
                total: 50,
                orderItems: {
                  create: [
                    {
                      variantId: 'variant-1',
                      nameSnapshot: 'Shirt',
                      skuSnapshot: 'SKU-1',
                      priceSnapshot: 50,
                      quantity: 1,
                    },
                  ],
                },
              }),
              expect.objectContaining({
                brandBranchId: 'branch-2',
                deliveryFee: 5,
                discountShare: 5,
                total: 50,
                orderItems: {
                  create: [
                    {
                      variantId: 'variant-2',
                      nameSnapshot: 'Pants',
                      skuSnapshot: 'SKU-2',
                      priceSnapshot: 50,
                      quantity: 1,
                    },
                  ],
                },
              }),
            ]),
          },
        }),
      }),
    );
    expect(socketService.notifyOrderCreated).toHaveBeenCalledWith(
      'brand-1',
      expect.objectContaining({
        parentOrderId: 'order-1',
        branchOrders: expect.arrayContaining([
          expect.objectContaining({
            branchOrderId: 'branch-order-1',
            brandBranchId: 'branch-1',
          }),
        ]),
      }),
    );
  });

  it('returns the existing order when the checkout was already placed', async () => {
    const { service, tx, socketService } = createService(CheckoutStatus.placed);
    const existingOrder = { parentOrderId: 'order-1' };
    tx.parentOrder.findUnique.mockResolvedValue(existingOrder);

    await expect(service.placeOrder('checkout-1', 'user-1')).resolves.toBe(
      existingOrder,
    );

    expect(tx.parentOrder.create).not.toHaveBeenCalled();
    expect(tx.checkoutSession.updateMany).not.toHaveBeenCalled();
    expect(socketService.notifyOrderCreated).not.toHaveBeenCalled();
  });
});

describe('CheckoutService.createPaymentSession', () => {
  it('creates Stripe checkout for the requested ready checkout', async () => {
    const stripeCheckout = {
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/session',
    };
    const findFirst = jest.fn().mockResolvedValue({
      id: 'checkout-1',
      status: CheckoutStatus.ready,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const createCheckout = jest.fn().mockResolvedValue(stripeCheckout);
    const service = new CheckoutService(
      {} as never,
      {} as never,
      {
        prisma: { checkoutSession: { findFirst } },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { createCheckout } as never,
      {
        notifyOrderCreated: jest.fn(),
        notifyCheckoutPaymentUpdated: jest.fn(),
      } as never,
    );

    await expect(
      service.createPaymentSession('checkout-1', 'user-1'),
    ).resolves.toBe(stripeCheckout);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'checkout-1',
        userId: 'user-1',
        status: {
          in: [
            CheckoutStatus.ready,
            CheckoutStatus.payment_pending,
            CheckoutStatus.payment_failed,
          ],
        },
        expiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(createCheckout).toHaveBeenCalledWith('user-1', 'checkout-1');
  });
});

describe('CheckoutService.handleStripeCheckoutEvent', () => {
  function createPaymentHandler() {
    const checkoutSession = {
      id: 'checkout-1',
      userId: 'user-1',
      status: CheckoutStatus.payment_pending,
      paymentStatus: 'pending',
      stripeSessionId: 'cs_test_1',
      stripePaymentIntentId: 'pi_test_1',
    };
    const findFirst = jest.fn().mockResolvedValue(checkoutSession);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new CheckoutService(
      {} as never,
      {} as never,
      {
        prisma: { checkoutSession: { findFirst, updateMany } },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        notifyOrderCreated: jest.fn(),
        notifyCheckoutPaymentUpdated: jest.fn(),
      } as never,
    );
    const placeOrder = jest
      .spyOn(service, 'placeOrder')
      .mockResolvedValue({ parentOrderId: 'order-1' } as never);

    return { service, findFirst, updateMany, placeOrder };
  }

  it('marks a paid Stripe checkout successful and places its order', async () => {
    const { service, findFirst, updateMany, placeOrder } =
      createPaymentHandler();
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          payment_intent: 'pi_test_1',
          metadata: { checkoutId: 'checkout-1', userId: 'user-1' },
        },
      },
    };

    await service.handleStripeCheckoutEvent(event as never);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'checkout-1',
          userId: 'user-1',
          stripeSessionId: 'cs_test_1',
        },
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'succeeded' }),
      }),
    );
    expect(placeOrder).toHaveBeenCalledWith('checkout-1', 'user-1');
  });

  it('records an expired Stripe checkout without creating an order', async () => {
    const { service, updateMany, placeOrder } = createPaymentHandler();
    const event = {
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'unpaid',
          payment_intent: null,
          metadata: { checkoutId: 'checkout-1', userId: 'user-1' },
        },
      },
    };

    await service.handleStripeCheckoutEvent(event as never);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CheckoutStatus.expired,
          paymentStatus: 'cancelled',
        }),
      }),
    );
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('records a failed Stripe payment attempt without completing the checkout', async () => {
    const { service, updateMany, placeOrder } = createPaymentHandler();
    const event = {
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test_1',
          metadata: {
            checkoutId: 'checkout-1',
            userId: 'user-1',
            paymentAttempt: '1',
          },
        },
      },
    };

    await service.handleStripeCheckoutEvent(event as never);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'checkout-1',
          paymentAttempt: 1,
          status: CheckoutStatus.payment_pending,
        }),
        data: expect.objectContaining({ paymentStatus: 'failed' }),
      }),
    );
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('records a full Stripe refund against its payment intent', async () => {
    const { service, findFirst, updateMany, placeOrder } =
      createPaymentHandler();
    const event = {
      type: 'charge.refunded',
      data: {
        object: {
          refunded: true,
          payment_intent: 'pi_test_1',
        },
      },
    };

    await service.handleStripeCheckoutEvent(event as never);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          stripePaymentIntentId: 'pi_test_1',
          paymentStatus: 'succeeded',
        },
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { paymentStatus: 'refunded' },
      }),
    );
    expect(placeOrder).not.toHaveBeenCalled();
  });
});
