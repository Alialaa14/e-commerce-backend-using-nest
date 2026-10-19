import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { StockLedgerService } from './stock-ledger.service';

describe('StockLedgerService', () => {
  it('creates a stock ledger record through the caller transaction', async () => {
    const record = {
      id: 'ledger-1',
      inventoryId: 'inventory-1',
      variantId: 'variant-1',
      changeQty: 5,
      reason: 'receive',
      referenceType: 'RECEIPT',
      referenceId: 'receipt-1',
      userId: 'user-1',
      note: null,
      createdAt: new Date('2026-10-18T00:00:00.000Z'),
    };
    const create = jest.fn().mockResolvedValue(record);
    const transaction = {
      stockLedger: { create },
    } as unknown as Prisma.TransactionClient;
    const service = new StockLedgerService();

    await expect(
      service.createRecord(transaction, {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        changeQty: 5,
        reason: 'receive',
        referenceType: 'RECEIPT',
        referenceId: 'receipt-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual(record);

    expect(create).toHaveBeenCalledWith({
      data: {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        changeQty: 5,
        reason: 'receive',
        referenceType: 'RECEIPT',
        referenceId: 'receipt-1',
        userId: 'user-1',
      },
      select: {
        id: true,
        inventoryId: true,
        variantId: true,
        changeQty: true,
        reason: true,
        referenceType: true,
        referenceId: true,
        userId: true,
        note: true,
        createdAt: true,
      },
    });
  });

  it('rejects zero or non-integer stock changes', async () => {
    const create = jest.fn();
    const transaction = {
      stockLedger: { create },
    } as unknown as Prisma.TransactionClient;
    const service = new StockLedgerService();

    await expect(
      service.createRecord(transaction, {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        changeQty: 0,
        reason: 'receive',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createRecord(transaction, {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        changeQty: 1.5,
        reason: 'receive',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(create).not.toHaveBeenCalled();
  });
});
