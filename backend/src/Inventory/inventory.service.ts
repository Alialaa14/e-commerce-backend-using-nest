import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { inventoryType, Prisma } from '../generated/prisma';
import { paginate } from '../helpers/paginate';
import { PrismaService } from '../utils/prisma/prisma.service';
import { StockLedgerService } from '../StockLedger/stock-ledger.service';
import { GetBranchInventoryQueryDto } from './dto/get-branch-inventory-query.dto';

export interface CreateInventoryInput {
  brandId: string;
  branchId?: string;
  type: inventoryType;
}

export interface SetBranchVariantStockInput {
  onHand: number;
  lowStockThreshold?: number;
}

interface LockedStock {
  onHand: number;
  reserved: number;
  inTransitIn: number;
  lowStockThreshold: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly stockLedgerService: StockLedgerService,
  ) {}

  async getBranchVariantStock(branchId: string, variantId: string) {
    const inventory = await this.prismaService.prisma.inventory.findFirst({
      where: { branchId, isActive: true },
      select: { id: true },
    });
    if (!inventory) {
      throw new NotFoundException('Branch inventory not found');
    }

    const stock = await this.prismaService.prisma.inventoryStock.findUnique({
      where: {
        inventoryId_variantId: {
          inventoryId: inventory.id,
          variantId,
        },
      },
      select: {
        inventoryId: true,
        variantId: true,
        onHand: true,
        reserved: true,
        inTransitIn: true,
        lowStockThreshold: true,
        updatedAt: true,
        variant: {
          select: {
            id: true,
            sku: true,
            color: true,
            size: true,
            isActive: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!stock) {
      throw new NotFoundException('Stock record not found for this variant');
    }

    return { ...stock, available: stock.onHand - stock.reserved };
  }

  async setBranchVariantStock(
    branchId: string,
    variantId: string,
    input: SetBranchVariantStockInput,
    userId: string,
    note?: string,
  ) {
    this.assertNonNegativeInteger(input.onHand, 'onHand');
    if (input.lowStockThreshold !== undefined) {
      this.assertNonNegativeInteger(
        input.lowStockThreshold,
        'lowStockThreshold',
      );
    }

    return this.prismaService.prisma.$transaction(async (transaction) => {
      const inventory = await transaction.inventory.findFirst({
        where: { branchId, isActive: true },
        select: { id: true },
      });
      if (!inventory) {
        throw new NotFoundException('Branch inventory not found');
      }

      await transaction.inventoryStock.upsert({
        where: {
          inventoryId_variantId: {
            inventoryId: inventory.id,
            variantId,
          },
        },
        create: {
          inventoryId: inventory.id,
          variantId,
        },
        update: {},
      });
      const current = await this.lockStock(
        transaction,
        inventory.id,
        variantId,
      );
      if (!current) {
        throw new NotFoundException('Stock record not found for this variant');
      }
      if (input.onHand < current.reserved) {
        throw new BadRequestException(
          'On-hand stock cannot be lower than reserved stock',
        );
      }

      const update = await transaction.inventoryStock.updateMany({
        where: { inventoryId: inventory.id, variantId },
        data: {
          onHand: input.onHand,
          ...(input.lowStockThreshold !== undefined
            ? { lowStockThreshold: input.lowStockThreshold }
            : {}),
        },
      });
      if (update.count !== 1) {
        throw new ConflictException('Stock changed; retry the adjustment');
      }

      const changeQty = input.onHand - current.onHand;
      if (changeQty !== 0) {
        await this.stockLedgerService.createRecord(transaction, {
          inventoryId: inventory.id,
          variantId,
          changeQty,
          reason: 'adjustment',
          userId,
          note: note ?? null,
        });
      }

      return {
        inventoryId: inventory.id,
        variantId,
        onHand: input.onHand,
        reserved: current.reserved,
        available: input.onHand - current.reserved,
        inTransitIn: current.inTransitIn,
        lowStockThreshold: input.lowStockThreshold ?? current.lowStockThreshold,
      };
    });
  }

  async reserveStock(
    inventoryId: string,
    variantId: string,
    quantity: number,
    referenceId: string,
    userId?: string,
  ) {
    this.assertPositiveInteger(quantity);
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const stock = await this.lockStock(transaction, inventoryId, variantId);
      if (!stock) {
        throw new NotFoundException('Stock record not found');
      }
      if (stock.onHand - stock.reserved < quantity) {
        throw new BadRequestException(
          `Insufficient available stock for variant ${variantId}`,
        );
      }

      await this.updateLockedStock(
        transaction,
        inventoryId,
        variantId,
        { reserved: { increment: quantity } },
        { onHand: { gte: stock.reserved + quantity } },
      );
      await this.stockLedgerService.createRecord(transaction, {
        inventoryId,
        variantId,
        changeQty: quantity,
        reason: 'reserve',
        referenceType: 'RESERVATION',
        referenceId,
        ...(userId ? { userId } : {}),
      });
      return this.stockSummary(
        inventoryId,
        variantId,
        stock.onHand,
        stock.reserved + quantity,
        stock.inTransitIn,
        stock.lowStockThreshold,
      );
    });
  }

  async releaseStock(
    inventoryId: string,
    variantId: string,
    quantity: number,
    referenceId: string,
    userId?: string,
  ) {
    this.assertPositiveInteger(quantity);
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const stock = await this.lockStock(transaction, inventoryId, variantId);
      if (!stock) {
        throw new NotFoundException('Stock record not found');
      }
      if (stock.reserved < quantity) {
        throw new ConflictException('Cannot release more stock than reserved');
      }

      await this.updateLockedStock(
        transaction,
        inventoryId,
        variantId,
        { reserved: { decrement: quantity } },
        { reserved: { gte: quantity } },
      );
      await this.stockLedgerService.createRecord(transaction, {
        inventoryId,
        variantId,
        changeQty: -quantity,
        reason: 'release',
        referenceType: 'RESERVATION',
        referenceId,
        ...(userId ? { userId } : {}),
      });
      return this.stockSummary(
        inventoryId,
        variantId,
        stock.onHand,
        stock.reserved - quantity,
        stock.inTransitIn,
        stock.lowStockThreshold,
      );
    });
  }

  async fulfillReservedStock(
    inventoryId: string,
    variantId: string,
    quantity: number,
    orderId: string,
    userId?: string,
  ) {
    this.assertPositiveInteger(quantity);
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const stock = await this.lockStock(transaction, inventoryId, variantId);
      if (!stock) {
        throw new NotFoundException('Stock record not found');
      }
      if (stock.reserved < quantity || stock.onHand < quantity) {
        throw new ConflictException(
          'Cannot fulfill more stock than is reserved and on hand',
        );
      }

      await this.updateLockedStock(
        transaction,
        inventoryId,
        variantId,
        {
          onHand: { decrement: quantity },
          reserved: { decrement: quantity },
        },
        {
          onHand: { gte: quantity },
          reserved: { gte: quantity },
        },
      );
      await this.stockLedgerService.createRecord(transaction, {
        inventoryId,
        variantId,
        changeQty: -quantity,
        reason: 'sale',
        referenceType: 'ORDER',
        referenceId: orderId,
        ...(userId ? { userId } : {}),
      });
      return this.stockSummary(
        inventoryId,
        variantId,
        stock.onHand - quantity,
        stock.reserved - quantity,
        stock.inTransitIn,
        stock.lowStockThreshold,
      );
    });
  }

  async createInventory(
    input: CreateInventoryInput,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prismaService.prisma).inventory.create({
      data: input,
    });
  }

  async deleteInventory(
    inventoryId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    if (transaction) {
      return this.deactivateInventory(inventoryId, transaction);
    }

    return this.prismaService.prisma.$transaction((tx) =>
      this.deactivateInventory(inventoryId, tx),
    );
  }

  async deleteBranchInventory(
    branchId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = transaction ?? this.prismaService.prisma;
    const inventory = await client.inventory.findUnique({
      where: { branchId },
      select: { id: true },
    });
    if (!inventory) {
      throw new NotFoundException('Branch inventory not found');
    }

    return this.deleteInventory(inventory.id, transaction);
  }

  async deleteMainInventory(
    brandId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = transaction ?? this.prismaService.prisma;
    const inventory = await client.inventory.findFirst({
      where: { brandId, branchId: null, type: inventoryType.main },
      select: { id: true },
    });
    if (!inventory) {
      throw new NotFoundException('Main inventory not found');
    }

    return this.deleteInventory(inventory.id, transaction);
  }

  private async deactivateInventory(
    inventoryId: string,
    transaction: Prisma.TransactionClient,
  ) {
    const inventory = await transaction.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true, isActive: true },
    });
    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    const nonzeroStock = await transaction.inventoryStock.findMany({
      where: {
        inventoryId,
        OR: [
          { onHand: { not: 0 } },
          { reserved: { not: 0 } },
          { inTransitIn: { not: 0 } },
        ],
      },
      select: {
        onHand: true,
        reserved: true,
        inTransitIn: true,
        variant: {
          select: { sku: true, product: { select: { name: true } } },
        },
      },
    });
    if (nonzeroStock.length) {
      const productNames = [
        ...new Set(nonzeroStock.map((stock) => stock.variant.product.name)),
      ];
      throw new ConflictException(
        `Cannot delete inventory while stock remains for: ${productNames.join(', ')}`,
      );
    }

    if (!inventory.isActive) {
      return inventory;
    }

    return transaction.inventory.update({
      where: { id: inventoryId },
      data: { isActive: false },
    });
  }

  async getBranchInventory(
    branchId: string,
    query: GetBranchInventoryQueryDto = {},
  ) {
    const inventory = await this.prismaService.prisma.inventory.findUnique({
      where: { branchId },
      select: {
        id: true,
        type: true,
        brandId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Branch inventory not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const variantWhere: Prisma.VariantWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.color
        ? { color: { equals: query.color, mode: 'insensitive' } }
        : {}),
      ...(query.size
        ? { size: { equals: query.size, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' } },
              {
                product: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const where: Prisma.InventoryStockWhereInput = {
      inventoryId: inventory.id,
      ...(Object.keys(variantWhere).length
        ? { variant: { is: variantWhere } }
        : {}),
    };
    const { skip, take } = paginate(page, limit);
    const [stocks, total] = await this.prismaService.prisma.$transaction([
      this.prismaService.prisma.inventoryStock.findMany({
        where,
        skip,
        take,
        orderBy: { variant: { sku: 'asc' } },
        select: {
          variantId: true,
          onHand: true,
          reserved: true,
          inTransitIn: true,
          lowStockThreshold: true,
          updatedAt: true,
          variant: {
            select: {
              id: true,
              sku: true,
              color: true,
              size: true,
              basePrice: true,
              options: true,
              isActive: true,
              isDeleted: true,
              product: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      }),
      this.prismaService.prisma.inventoryStock.count({ where }),
    ]);

    return {
      ...inventory,
      stocks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async lockStock(
    transaction: Prisma.TransactionClient,
    inventoryId: string,
    variantId: string,
  ): Promise<LockedStock | null> {
    const rows = await transaction.$queryRaw<LockedStock[]>`
      SELECT
        on_hand AS "onHand",
        reserved,
        in_transit_in AS "inTransitIn",
        low_stock_threshold AS "lowStockThreshold"
      FROM inventory_stocks
      WHERE inventory_id = ${inventoryId}::uuid
        AND variant_id = ${variantId}::uuid
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  private async updateLockedStock(
    transaction: Prisma.TransactionClient,
    inventoryId: string,
    variantId: string,
    data: Prisma.InventoryStockUpdateManyMutationInput,
    guard: Prisma.InventoryStockWhereInput = {},
  ) {
    const result = await transaction.inventoryStock.updateMany({
      where: { inventoryId, variantId, ...guard },
      data,
    });
    if (result.count !== 1) {
      throw new ConflictException('Stock changed; retry the operation');
    }
  }

  private stockSummary(
    inventoryId: string,
    variantId: string,
    onHand: number,
    reserved: number,
    inTransitIn: number,
    lowStockThreshold: number,
  ) {
    return {
      inventoryId,
      variantId,
      onHand,
      reserved,
      available: onHand - reserved,
      inTransitIn,
      lowStockThreshold,
    };
  }

  private assertPositiveInteger(quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
  }

  private assertNonNegativeInteger(value: number, field: string) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer`);
    }
  }
}
