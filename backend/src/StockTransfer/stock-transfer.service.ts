import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransferStatus } from '../generated/prisma';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { paginate } from '../helpers/paginate';
import { PrismaService } from '../utils/prisma/prisma.service';

export interface CreateStockTransferInput {
  fromInventoryId: string;
  toInventoryId: string;
  items: { variantId: string; qtyRequested: number }[];
}

interface TransferInventory {
  id: string;
  brandId: string;
  branchId: string | null;
  type: 'main' | 'branch';
  isActive: boolean;
  brand: { userId: string };
  branch: { id: string; isActive: boolean; deletedAt: Date | null } | null;
}

@Injectable()
export class StockTransferService {
  constructor(private readonly prismaService: PrismaService) {}

  private static readonly TRANSFER_INCLUDE = {
    items: true,
    from: {
      select: {
        id: true,
        brandId: true,
        branchId: true,
        type: true,
        isActive: true,
        brand: { select: { userId: true } },
        branch: {
          select: { id: true, isActive: true, deletedAt: true },
        },
      },
    },
    to: {
      select: {
        id: true,
        brandId: true,
        branchId: true,
        type: true,
        isActive: true,
        brand: { select: { userId: true } },
        branch: {
          select: { id: true, isActive: true, deletedAt: true },
        },
      },
    },
  } satisfies Prisma.StockTransferInclude;

  async createTransfer(user: AuthUser, input: CreateStockTransferInput) {
    if (input.fromInventoryId === input.toInventoryId) {
      throw new BadRequestException('Source and destination must be different');
    }
    if (!input.items.length) {
      throw new BadRequestException('At least one transfer item is required');
    }
    const variantIds = input.items.map((item) => item.variantId);
    if (new Set(variantIds).size !== variantIds.length) {
      throw new BadRequestException('Each variant can only be listed once');
    }

    return this.prismaService.prisma.$transaction(async (transaction) => {
      const [source, destination] = await Promise.all([
        this.getInventory(transaction, input.fromInventoryId),
        this.getInventory(transaction, input.toInventoryId),
      ]);
      this.assertInventoryActive(source);
      this.assertInventoryActive(destination);
      if (source.brandId !== destination.brandId) {
        throw new BadRequestException(
          'Transfers must stay within the same brand',
        );
      }
      this.assertInventoryAccess(user, source);

      const variants = await transaction.variant.findMany({
        where: {
          id: { in: variantIds },
          product: {
            brandId: source.brandId,
            deletedAt: null,
            isDeleted: false,
          },
        },
        select: { id: true },
      });
      if (variants.length !== variantIds.length) {
        throw new NotFoundException(
          'One or more variants do not belong to this brand',
        );
      }

      return transaction.stockTransfer.create({
        data: {
          fromInventoryId: source.id,
          toInventoryId: destination.id,
          createdBy: user.sub,
          items: {
            create: input.items.map((item) => ({
              variantId: item.variantId,
              qtyRequested: item.qtyRequested,
            })),
          },
        },
        include: {
          items: true,
          from: { select: { id: true, type: true, branchId: true } },
          to: { select: { id: true, type: true, branchId: true } },
        },
      });
    });
  }

  async approveTransfer(user: AuthUser, transferId: string) {
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const transfer = await this.getTransferForTransaction(
        transaction,
        transferId,
      );
      this.assertTransferInventoriesActive(transfer);
      this.assertInventoryAccess(user, transfer.to);
      if (transfer.status !== TransferStatus.requested) {
        throw new ConflictException('Only requested transfers can be approved');
      }

      const updated = await transaction.stockTransfer.updateMany({
        where: { id: transferId, status: TransferStatus.requested },
        data: { status: TransferStatus.approved, approvedBy: user.sub },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Transfer state changed; reload and retry');
      }
      return transaction.stockTransfer.findUnique({
        where: { id: transferId },
        include: StockTransferService.TRANSFER_INCLUDE,
      });
    });
  }

  async shipTransfer(user: AuthUser, transferId: string) {
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const transfer = await this.getTransferForTransaction(
        transaction,
        transferId,
      );
      this.assertTransferInventoriesActive(transfer);
      this.assertInventoryAccess(user, transfer.from);
      if (transfer.status !== TransferStatus.approved) {
        throw new ConflictException('Only approved transfers can be shipped');
      }

      const variantIds = transfer.items.map((item) => item.variantId);
      const stockRows = await transaction.$queryRaw<
        { variantId: string; onHand: number; reserved: number }[]
      >`
        SELECT variant_id AS "variantId", on_hand AS "onHand", reserved
        FROM inventory_stocks
        WHERE inventory_id = ${transfer.fromInventoryId}::uuid
          AND variant_id IN (${Prisma.join(variantIds)})
        FOR UPDATE
      `;
      const stockByVariant = new Map(
        stockRows.map((stock) => [stock.variantId, stock]),
      );
      for (const item of transfer.items) {
        const stock = stockByVariant.get(item.variantId);
        if (!stock || stock.onHand - stock.reserved < item.qtyRequested) {
          throw new BadRequestException(
            `Insufficient available stock for variant ${item.variantId}`,
          );
        }
      }

      const ledgerEntries: Prisma.StockLedgerCreateManyInput[] = [];
      for (const item of transfer.items) {
        const stock = stockByVariant.get(item.variantId)!;
        const sourceUpdate = await transaction.inventoryStock.updateMany({
          where: {
            inventoryId: transfer.fromInventoryId,
            variantId: item.variantId,
            onHand: { gte: item.qtyRequested + stock.reserved },
          },
          data: { onHand: { decrement: item.qtyRequested } },
        });
        if (sourceUpdate.count !== 1) {
          throw new ConflictException('Source stock changed; retry shipment');
        }

        await transaction.inventoryStock.upsert({
          where: {
            inventoryId_variantId: {
              inventoryId: transfer.toInventoryId,
              variantId: item.variantId,
            },
          },
          create: {
            inventoryId: transfer.toInventoryId,
            variantId: item.variantId,
            inTransitIn: item.qtyRequested,
          },
          update: { inTransitIn: { increment: item.qtyRequested } },
        });
        await transaction.stockTransferItem.updateMany({
          where: { id: item.id, qtyShipped: item.qtyShipped },
          data: { qtyShipped: item.qtyRequested },
        });
        ledgerEntries.push(
          {
            inventoryId: transfer.fromInventoryId,
            variantId: item.variantId,
            changeQty: -item.qtyRequested,
            reason: 'transfer_out',
            referenceType: 'TRANSFER',
            referenceId: transferId,
            userId: user.sub,
          },
          {
            inventoryId: transfer.toInventoryId,
            variantId: item.variantId,
            changeQty: item.qtyRequested,
            reason: 'transfer_in',
            referenceType: 'TRANSFER',
            referenceId: transferId,
            userId: user.sub,
          },
        );
      }
      await transaction.stockLedger.createMany({ data: ledgerEntries });

      const updated = await transaction.stockTransfer.updateMany({
        where: { id: transferId, status: TransferStatus.approved },
        data: { status: TransferStatus.shipped, shippedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Transfer state changed; retry shipment');
      }
      return transaction.stockTransfer.findUnique({
        where: { id: transferId },
        include: StockTransferService.TRANSFER_INCLUDE,
      });
    });
  }

  async receiveTransfer(
    user: AuthUser,
    transferId: string,
    items: { variantId: string; qtyReceived: number }[],
  ) {
    if (
      !items.length ||
      new Set(items.map((item) => item.variantId)).size !== items.length
    ) {
      throw new BadRequestException(
        'Provide at least one unique variant to receive',
      );
    }

    return this.prismaService.prisma.$transaction(async (transaction) => {
      const transfer = await this.getTransferForTransaction(
        transaction,
        transferId,
      );
      this.assertTransferInventoriesActive(transfer);
      this.assertInventoryAccess(user, transfer.to);
      if (
        transfer.status !== TransferStatus.shipped &&
        transfer.status !== TransferStatus.partially_received
      ) {
        throw new ConflictException('This transfer cannot be received');
      }

      const itemsByVariant = new Map(
        transfer.items.map((item) => [item.variantId, item]),
      );
      const nextReceived = new Map(
        transfer.items.map((item) => [item.variantId, item.qtyReceived]),
      );
      for (const receipt of items) {
        const transferItem = itemsByVariant.get(receipt.variantId);
        if (
          !transferItem ||
          receipt.qtyReceived < 1 ||
          receipt.qtyReceived >
            transferItem.qtyShipped - transferItem.qtyReceived
        ) {
          throw new BadRequestException(
            `Invalid received quantity for variant ${receipt.variantId}`,
          );
        }
        const stockUpdate = await transaction.inventoryStock.updateMany({
          where: {
            inventoryId: transfer.toInventoryId,
            variantId: receipt.variantId,
            inTransitIn: { gte: receipt.qtyReceived },
          },
          data: {
            inTransitIn: { decrement: receipt.qtyReceived },
            onHand: { increment: receipt.qtyReceived },
          },
        });
        if (stockUpdate.count !== 1) {
          throw new ConflictException(
            'In-transit stock changed; retry receipt',
          );
        }

        const itemUpdate = await transaction.stockTransferItem.updateMany({
          where: {
            id: transferItem.id,
            qtyReceived: transferItem.qtyReceived,
          },
          data: { qtyReceived: { increment: receipt.qtyReceived } },
        });
        if (itemUpdate.count !== 1) {
          throw new ConflictException('Receipt changed; reload and retry');
        }
        nextReceived.set(
          receipt.variantId,
          transferItem.qtyReceived + receipt.qtyReceived,
        );
      }

      const isReceived = transfer.items.every(
        (item) => nextReceived.get(item.variantId) === item.qtyShipped,
      );
      const nextStatus = isReceived
        ? TransferStatus.received
        : TransferStatus.partially_received;
      const updated = await transaction.stockTransfer.updateMany({
        where: {
          id: transferId,
          status: transfer.status as TransferStatus,
        },
        data: {
          status: nextStatus,
          ...(isReceived ? { receivedAt: new Date() } : {}),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Transfer state changed; retry receipt');
      }
      return transaction.stockTransfer.findUnique({
        where: { id: transferId },
        include: StockTransferService.TRANSFER_INCLUDE,
      });
    });
  }

  async cancelTransfer(user: AuthUser, transferId: string) {
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const transfer = await this.getTransferForTransaction(
        transaction,
        transferId,
      );
      this.assertInventoryAccess(user, transfer.from);
      if (
        transfer.status !== TransferStatus.requested &&
        transfer.status !== TransferStatus.approved
      ) {
        throw new ConflictException(
          'Only unshipped transfers can be cancelled',
        );
      }
      const updated = await transaction.stockTransfer.updateMany({
        where: {
          id: transferId,
          status: { in: [TransferStatus.requested, TransferStatus.approved] },
        },
        data: { status: TransferStatus.cancelled },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Transfer state changed; retry cancellation',
        );
      }
      return transaction.stockTransfer.findUnique({
        where: { id: transferId },
        include: StockTransferService.TRANSFER_INCLUDE,
      });
    });
  }

  async getTransfer(user: AuthUser, transferId: string) {
    const transfer = await this.prismaService.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: StockTransferService.TRANSFER_INCLUDE,
    });
    if (!transfer) {
      throw new NotFoundException('Stock transfer not found');
    }
    if (
      !this.hasInventoryAccess(user, transfer.from) &&
      !this.hasInventoryAccess(user, transfer.to)
    ) {
      throw new NotFoundException('Stock transfer not found');
    }
    return transfer;
  }

  async listTransfers(
    user: AuthUser,
    query: { page?: number; limit?: number; status?: TransferStatus } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const scope =
      user.role === 'brandOwner'
        ? {
            OR: [
              { from: { is: { brand: { is: { userId: user.sub } } } } },
              { to: { is: { brand: { is: { userId: user.sub } } } } },
            ],
          }
        : user.role === 'BRANCH_MANAGER' && user.branchId
          ? {
              OR: [
                { from: { is: { branchId: user.branchId } } },
                { to: { is: { branchId: user.branchId } } },
              ],
            }
          : null;
    if (!scope) {
      throw new ForbiddenException('You cannot view stock transfers');
    }
    const where: Prisma.StockTransferWhereInput = {
      ...scope,
      ...(query.status ? { status: query.status } : {}),
    };
    const { skip, take } = paginate(page, limit);
    const [data, total] = await this.prismaService.prisma.$transaction([
      this.prismaService.prisma.stockTransfer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: StockTransferService.TRANSFER_INCLUDE,
      }),
      this.prismaService.prisma.stockTransfer.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async getTransferForTransaction(
    transaction: Prisma.TransactionClient,
    transferId: string,
  ) {
    const transfer = await transaction.stockTransfer.findUnique({
      where: { id: transferId },
      include: StockTransferService.TRANSFER_INCLUDE,
    });
    if (!transfer) {
      throw new NotFoundException('Stock transfer not found');
    }
    return transfer;
  }

  private assertTransferInventoriesActive(transfer: {
    from: TransferInventory;
    to: TransferInventory;
  }) {
    this.assertInventoryActive(transfer.from);
    this.assertInventoryActive(transfer.to);
    if (transfer.from.brandId !== transfer.to.brandId) {
      throw new BadRequestException(
        'Transfers must stay within the same brand',
      );
    }
  }

  private async getInventory(
    transaction: Prisma.TransactionClient,
    inventoryId: string,
  ): Promise<TransferInventory> {
    const inventory = await transaction.inventory.findUnique({
      where: { id: inventoryId },
      select: {
        id: true,
        brandId: true,
        branchId: true,
        type: true,
        isActive: true,
        brand: { select: { userId: true } },
        branch: {
          select: { id: true, isActive: true, deletedAt: true },
        },
      },
    });
    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }
    return inventory;
  }

  private assertInventoryActive(inventory: TransferInventory) {
    if (
      !inventory.isActive ||
      (inventory.type === 'branch' &&
        (!inventory.branch ||
          !inventory.branch.isActive ||
          inventory.branch.deletedAt))
    ) {
      throw new ConflictException('Inventory is inactive');
    }
  }

  private assertInventoryAccess(user: AuthUser, inventory: TransferInventory) {
    if (this.hasInventoryAccess(user, inventory)) {
      return;
    }
    throw new ForbiddenException('You cannot manage this inventory');
  }

  private hasInventoryAccess(user: AuthUser, inventory: TransferInventory) {
    if (
      inventory.type === 'main' &&
      user.role === 'brandOwner' &&
      inventory.brand.userId === user.sub
    ) {
      return true;
    }
    if (
      inventory.type === 'branch' &&
      user.role === 'BRANCH_MANAGER' &&
      user.branchId === inventory.branchId
    ) {
      return true;
    }
    return false;
  }
}
