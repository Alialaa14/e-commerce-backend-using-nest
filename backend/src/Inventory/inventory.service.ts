import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { inventoryType, Prisma } from '../generated/prisma';
import { paginate } from '../helpers/paginate';
import { PrismaService } from '../utils/prisma/prisma.service';
import { GetBranchInventoryQueryDto } from './dto/get-branch-inventory-query.dto';

export interface CreateInventoryInput {
  brandId: string;
  branchId?: string;
  type: inventoryType;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

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
}
