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
    );

    return { service, tx };
  }

  it('creates one parent order with a branch order for every shipment', async () => {
    const createOrder = jest
      .fn()
      .mockResolvedValue({ parentOrderId: 'order-1' });
    const { service, tx } = createService(CheckoutStatus.ready, createOrder);

    await service.placeOrder('checkout-1', 'user-1');

    expect(tx.checkoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'checkout-1',
        userId: 'user-1',
        status: CheckoutStatus.ready,
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
  });

  it('returns the existing order when the checkout was already placed', async () => {
    const { service, tx } = createService(CheckoutStatus.placed);
    const existingOrder = { parentOrderId: 'order-1' };
    tx.parentOrder.findUnique.mockResolvedValue(existingOrder);

    await expect(service.placeOrder('checkout-1', 'user-1')).resolves.toBe(
      existingOrder,
    );

    expect(tx.parentOrder.create).not.toHaveBeenCalled();
    expect(tx.checkoutSession.updateMany).not.toHaveBeenCalled();
  });
});
