import { AddressService } from './address.service';

function transactionFor<T>(tx: T) {
  return jest.fn((callback: (client: T) => Promise<unknown>) => callback(tx));
}

describe('AddressService', () => {
  it('lists only the authenticated user addresses with the default first', async () => {
    const addresses = [{ id: 'address-1', isDefault: true }];
    const findMany = jest.fn().mockResolvedValue(addresses);
    const service = new AddressService({
      prisma: { address: { findMany } },
    } as never);

    await expect(service.list('user-1')).resolves.toBe(addresses);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      }),
    );
  });

  it('makes the first saved address the default', async () => {
    const address = { id: 'address-1', userId: 'user-1', isDefault: true };
    let createdData: Record<string, unknown> | undefined;
    const tx = {
      address: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          createdData = data;
          return Promise.resolve(address);
        }),
      },
    };
    const service = new AddressService({
      prisma: {
        $transaction: transactionFor(tx),
      },
    } as never);

    await expect(
      service.create('user-1', {
        label: 'Home',
        governorate: 'Cairo',
        city: 'Cairo',
        street: '12 Nile Street',
        contactPhone: '01012345678',
        latitude: 30.0444,
        longitude: 31.2357,
        isDefault: false,
      }),
    ).resolves.toBe(address);

    expect(createdData).toMatchObject({
      userId: 'user-1',
      isDefault: true,
      contactPhone: '+201012345678',
      addressText: '12 Nile Street, Cairo',
    });
  });

  it('clears the previous default when another address is selected', async () => {
    const address = {
      id: 'address-2',
      userId: 'user-1',
      isDefault: true,
    };
    let updatedData: Record<string, unknown> | undefined;
    const tx = {
      address: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'address-2',
          userId: 'user-1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          updatedData = data;
          return Promise.resolve(address);
        }),
      },
    };
    const service = new AddressService({
      prisma: {
        $transaction: transactionFor(tx),
      },
    } as never);

    await expect(
      service.update('user-1', 'address-2', { isDefault: true }),
    ).resolves.toBe(address);

    expect(tx.address.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'address-2', userId: 'user-1' },
      }),
    );
    expect(tx.address.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isDefault: true, id: { not: 'address-2' } },
      data: { isDefault: false },
    });
    expect(updatedData).toMatchObject({ isDefault: true });
  });

  it('promotes another owned address when deleting the default', async () => {
    const tx = {
      address: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'address-1',
            userId: 'user-1',
            isDefault: true,
          })
          .mockResolvedValueOnce({ id: 'address-2', userId: 'user-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'address-1' }),
        update: jest.fn().mockResolvedValue({ id: 'address-2' }),
      },
    };
    const service = new AddressService({
      prisma: {
        $transaction: transactionFor(tx),
      },
    } as never);

    await expect(service.remove('user-1', 'address-1')).resolves.toEqual({
      id: 'address-1',
    });

    expect(tx.address.findFirst).toHaveBeenCalledWith({
      where: { id: 'address-1', userId: 'user-1' },
      select: { id: true, isDefault: true },
    });
    expect(tx.address.update).toHaveBeenCalledWith({
      where: { id: 'address-2' },
      data: { isDefault: true },
    });
  });
});
