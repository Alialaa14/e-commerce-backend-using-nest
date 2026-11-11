import { BadRequestException, Injectable } from '@nestjs/common';
import { LedgerReason, Prisma } from '../generated/prisma';

export interface CreateStockLedgerInput {
  inventoryId: string;
  variantId: string;
  changeQty: number;
  reason: LedgerReason;
  referenceType?: string | null;
  referenceId?: string | null;
  userId?: string | null;
  note?: string | null;
}

@Injectable()
export class StockLedgerService {
  private static readonly RECORD_SELECT = {
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
  } satisfies Prisma.StockLedgerSelect;

  async createRecord(
    transaction: Prisma.TransactionClient,
    input: CreateStockLedgerInput,
  ) {
    this.validateChangeQuantity(input.changeQty);
    return transaction.stockLedger.create({
      data: input,
      select: StockLedgerService.RECORD_SELECT,
    });
  }

  async createRecords(
    transaction: Prisma.TransactionClient,
    inputs: readonly CreateStockLedgerInput[],
  ) {
    inputs.forEach((input) => this.validateChangeQuantity(input.changeQty));
    return transaction.stockLedger.createMany({ data: [...inputs] });
  }

  private validateChangeQuantity(changeQty: number) {
    if (!Number.isInteger(changeQty) || changeQty === 0) {
      throw new BadRequestException(
        'Stock ledger changes must be non-zero integers',
      );
    }
  }
}
