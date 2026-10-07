import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createUniqueSlug } from '../helpers/catalog-identifiers';
import { PrismaService } from '../utils/prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { AddCatalogVariantsDto } from './dto/add-catalog-variants.dto';
import { CreateCatalogProductDto } from './dto/create-catalog-product.dto';
import {
  CopyOfferingsDto,
  CreateBranchOfferingDto,
  UpdateBranchOfferingDto,
} from './dto/branch-offering.dto';
import { UpdateCatalogProductDto } from './dto/update-catalog-product.dto';
import { CatalogVariantDto } from './dto/catalog-variant.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prismaService: PrismaService) {}

  async createProduct(
    brandId: string | null | undefined,
    dto: CreateCatalogProductDto,
  ) {
    if (!brandId) throw new NotFoundException('Brand not found');

    return this.withUniqueConflict(() =>
      this.prismaService.prisma.$transaction(async (transaction) => {
        const [brand, category] = await Promise.all([
          transaction.brand.findUnique({
            where: { id: brandId },
            select: { id: true },
          }),
          transaction.category.findUnique({
            where: { id: dto.categoryId },
            select: { id: true },
          }),
        ]);
        if (!brand) throw new NotFoundException('Brand not found');
        if (!category) throw new NotFoundException('Category not found');

        const branchIds = dto.makeAvailableAtAllBranches
          ? (
              await transaction.brandBranch.findMany({
                where: { brandId, isActive: true, deletedAt: null },
                select: { id: true },
              })
            ).map((branch) => branch.id)
          : [];
        const product = await transaction.product.create({
          data: {
            name: dto.name,
            slug: createUniqueSlug(
              dto.name,
              randomUUID().replace(/-/g, '').slice(0, 12),
            ),
            description: dto.description,
            brandId,
            categoryId: dto.categoryId,
            media: this.toProductMedia(dto.media),
            price: Math.round(
              Math.min(...dto.variants.map((variant) => variant.basePrice)),
            ),
            available: true,
            status: 'active',
            variants: {
              create: dto.variants.map((variant, index) =>
                this.toVariantCreateInput(variant, index),
              ),
            },
          },
          include: { variants: true },
        });

        if (branchIds.length && product.variants.length) {
          await transaction.branchVariant.createMany({
            data: branchIds.flatMap((branchId) =>
              product.variants.map((variant) => ({
                branchId,
                variantId: variant.id,
                stockQuantity: 0,
                reservedQuantity: 0,
                isAvailable: true,
              })),
            ),
          });
        }

        return this.toProductDto(product);
      }),
    );
  }

  async updateProduct(
    brandId: string | null | undefined,
    productId: string,
    dto: UpdateCatalogProductDto,
  ) {
    if (!brandId) throw new NotFoundException('Product not found');
    const product = await this.prismaService.prisma.product.findFirst({
      where: { id: productId, brandId, deletedAt: null, isDeleted: false },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one product field is required');
    }
    if (dto.categoryId) {
      const category = await this.prismaService.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    try {
      const updated = await this.prismaService.prisma.product.update({
        where: { id: productId },
        data: {
          ...dto,
          ...(dto.name
            ? {
                slug: createUniqueSlug(
                  dto.name,
                  randomUUID().replace(/-/g, '').slice(0, 12),
                ),
              }
            : {}),
        },
        include: { variants: true },
      });
      return this.toProductDto(updated);
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  async softDeleteProduct(
    brandId: string | null | undefined,
    productId: string,
  ) {
    if (!brandId) throw new NotFoundException('Product not found');
    const result = await this.prismaService.prisma.product.updateMany({
      where: {
        id: productId,
        brandId,
        deletedAt: null,
        isDeleted: false,
      },
      data: {
        deletedAt: new Date(),
        status: 'archived',
        available: false,
        isDeleted: true,
      },
    });
    if (result.count !== 1) throw new NotFoundException('Product not found');
    return { id: productId };
  }

  async approveProduct(brandId: string | null | undefined, productId: string) {
    if (!brandId) throw new NotFoundException('Product not found');
    const result = await this.prismaService.prisma.product.updateMany({
      where: {
        id: productId,
        brandId,
        status: 'pending',
        deletedAt: null,
        isDeleted: false,
      },
      data: { status: 'active', available: true },
    });
    if (result.count !== 1) throw new NotFoundException('Product not found');
    return { id: productId, status: 'active' };
  }

  async addVariants(
    brandId: string | null | undefined,
    productId: string,
    dto: AddCatalogVariantsDto,
  ) {
    if (!brandId) throw new NotFoundException('Product not found');
    return this.withUniqueConflict(() =>
      this.prismaService.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.findFirst({
          where: {
            id: productId,
            brandId,
            deletedAt: null,
            isDeleted: false,
          },
          select: { id: true, branchId: true },
        });
        if (!product) throw new NotFoundException('Product not found');

        const variants = await transaction.variant.createManyAndReturn({
          data: dto.variants.map((variant, index) => ({
            productId,
            ...this.toVariantCreateInput(variant, index),
          })),
        });
        if (dto.makeAvailableAtAllBranches) {
          const branches = product.branchId
            ? [{ id: product.branchId }]
            : await transaction.brandBranch.findMany({
                where: { brandId, isActive: true, deletedAt: null },
                select: { id: true },
              });
          if (branches.length) {
            await transaction.branchVariant.createMany({
              data: branches.flatMap((branch) =>
                variants.map((variant) => ({
                  branchId: branch.id,
                  variantId: variant.id,
                  stockQuantity: 0,
                  reservedQuantity: 0,
                  isAvailable: true,
                })),
              ),
            });
          }
        }
        return variants.map((variant) => this.toVariantDto(variant));
      }),
    );
  }

  async createBranchProduct(branchId: string, dto: CreateCatalogProductDto) {
    return this.withUniqueConflict(() =>
      this.prismaService.prisma.$transaction(async (transaction) => {
        const branch = await transaction.brandBranch.findFirst({
          where: { id: branchId, isActive: true, deletedAt: null },
          select: { id: true, brandId: true },
        });
        if (!branch) throw new NotFoundException('Branch not found');
        const category = await transaction.category.findUnique({
          where: { id: dto.categoryId },
          select: { id: true },
        });
        if (!category) throw new NotFoundException('Category not found');

        const product = await transaction.product.create({
          data: {
            name: dto.name,
            slug: createUniqueSlug(
              dto.name,
              randomUUID().replace(/-/g, '').slice(0, 12),
            ),
            description: dto.description,
            brandId: branch.brandId,
            branchId,
            categoryId: dto.categoryId,
            media: this.toProductMedia(dto.media),
            price: Math.round(
              Math.min(...dto.variants.map((variant) => variant.basePrice)),
            ),
            available: false,
            status: 'pending',
            variants: {
              create: dto.variants.map((variant, index) =>
                this.toVariantCreateInput(variant, index),
              ),
            },
          },
          include: { variants: true },
        });
        if (product.variants.length) {
          await transaction.branchVariant.createMany({
            data: product.variants.map((variant) => ({
              branchId,
              variantId: variant.id,
              stockQuantity: 0,
              reservedQuantity: 0,
              isAvailable: true,
            })),
          });
        }
        return this.toProductDto(product);
      }),
    );
  }

  async createBranchOffer(
    branchId: string,
    variantId: string,
    dto: CreateBranchOfferingDto,
  ) {
    const branch = await this.prismaService.prisma.brandBranch.findFirst({
      where: { id: branchId, isActive: true, deletedAt: null },
      select: { brandId: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    const variant = await this.prismaService.prisma.variant.findFirst({
      where: {
        id: variantId,
        isActive: true,
        deletedAt: null,
        product: {
          brandId: branch.brandId,
          deletedAt: null,
          isDeleted: false,
        },
        isDeleted: false,
      },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    try {
      const offer = await this.prismaService.prisma.branchVariant.create({
        data: {
          branchId,
          variantId,
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          stockQuantity: 0,
          reservedQuantity: 0,
          isAvailable: true,
        },
        select: {
          branchId: true,
          variantId: true,
          price: true,
          stockQuantity: true,
          reservedQuantity: true,
          isAvailable: true,
        },
      });
      return this.toBranchOfferingDto(offer);
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  async updateBranchOffer(
    branchId: string,
    variantId: string,
    dto: UpdateBranchOfferingDto,
  ) {
    if (
      dto.stockQuantity === undefined &&
      dto.price === undefined &&
      dto.isAvailable === undefined
    ) {
      throw new BadRequestException('At least one offering field is required');
    }
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const offer = await transaction.branchVariant.findFirst({
        where: { branchId, variantId },
        select: { id: true, reservedQuantity: true },
      });
      if (!offer) throw new NotFoundException('Branch offering not found');
      if (
        dto.stockQuantity !== undefined &&
        dto.stockQuantity < offer.reservedQuantity
      ) {
        throw new BadRequestException(
          'Stock quantity cannot be less than reserved quantity',
        );
      }

      const updateResult = await transaction.branchVariant.updateMany({
        where: {
          id: offer.id,
          ...(dto.stockQuantity !== undefined
            ? { reservedQuantity: { lte: dto.stockQuantity } }
            : {}),
        },
        data: {
          ...(dto.stockQuantity !== undefined
            ? { stockQuantity: dto.stockQuantity }
            : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.isAvailable !== undefined
            ? { isAvailable: dto.isAvailable }
            : {}),
        },
      });
      if (updateResult.count !== 1) {
        throw new ConflictException(
          'Branch stock changed; reload the offering and retry',
        );
      }
      const updated = await transaction.branchVariant.findUnique({
        where: { id: offer.id },
        select: {
          branchId: true,
          variantId: true,
          price: true,
          stockQuantity: true,
          reservedQuantity: true,
          isAvailable: true,
        },
      });
      if (!updated) throw new NotFoundException('Branch offering not found');
      return this.toBranchOfferingDto(updated);
    });
  }

  async copyOfferings(branchId: string, dto: CopyOfferingsDto) {
    if (branchId === dto.sourceBranchId) {
      throw new BadRequestException('Source branch must be different');
    }
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const [target, source] = await Promise.all([
        transaction.brandBranch.findFirst({
          where: { id: branchId, isActive: true, deletedAt: null },
          select: { id: true, brandId: true },
        }),
        transaction.brandBranch.findFirst({
          where: {
            id: dto.sourceBranchId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true, brandId: true },
        }),
      ]);
      if (!target || !source || target.brandId !== source.brandId) {
        throw new NotFoundException('Branch not found');
      }

      const offerings = await transaction.branchVariant.findMany({
        where: {
          branchId: dto.sourceBranchId,
          variant: {
            isActive: true,
            deletedAt: null,
            isDeleted: false,
            product: { deletedAt: null, isDeleted: false },
          },
        },
        select: { variantId: true, price: true, isAvailable: true },
      });
      const created = offerings.length
        ? await transaction.branchVariant.createMany({
            data: offerings.map((offering) => ({
              branchId,
              variantId: offering.variantId,
              price: offering.price,
              stockQuantity: 0,
              reservedQuantity: 0,
              isAvailable: offering.isAvailable,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };
      return { copied: created.count };
    });
  }

  async softDeleteBranch(brandId: string | null | undefined, branchId: string) {
    if (!brandId) throw new NotFoundException('Branch not found');
    const result = await this.prismaService.prisma.brandBranch.updateMany({
      where: { id: branchId, brandId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    if (result.count !== 1) throw new NotFoundException('Branch not found');
    return { id: branchId };
  }

  private toVariantCreateInput(variant: CatalogVariantDto, index: number) {
    const sku =
      variant.sku ??
      `SKU-${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
    const color =
      variant.color ??
      (typeof variant.options?.color === 'string'
        ? variant.options.color
        : `option-${index + 1}`);
    const size =
      variant.size ??
      (typeof variant.options?.size === 'string'
        ? variant.options.size
        : 'default');
    return {
      sku,
      basePrice: variant.basePrice,
      barcode: variant.barcode,
      options: variant.options ?? { color, size },
      color,
      size,
    };
  }

  private toProductMedia(
    media?: Array<{ secure_url: string; public_id: string }>,
  ): Prisma.InputJsonValue[] {
    return (media ?? []).map((item) => ({
      secure_url: item.secure_url,
      public_id: item.public_id,
    }));
  }

  private toProductDto(product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    brandId: string;
    branchId?: string | null;
    categoryId: string;
    media?: unknown;
    status: string;
    variants?: Array<{
      id: string;
      sku: string;
      basePrice: unknown;
      barcode?: string | null;
      options: unknown;
      isActive: boolean;
    }>;
  }) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      brandId: product.brandId,
      branchId: product.branchId ?? null,
      categoryId: product.categoryId,
      media: product.media ?? [],
      status: product.status,
      variants: product.variants?.map((variant) => this.toVariantDto(variant)),
    };
  }

  private toVariantDto(variant: {
    id: string;
    sku: string;
    basePrice: unknown;
    barcode?: string | null;
    options: unknown;
    isActive: boolean;
  }) {
    return {
      id: variant.id,
      sku: variant.sku,
      basePrice: Number(variant.basePrice),
      barcode: variant.barcode ?? null,
      options: variant.options,
      isActive: variant.isActive,
    };
  }

  private toBranchOfferingDto(offer: {
    branchId: string;
    variantId: string;
    price: unknown;
    stockQuantity: number;
    reservedQuantity: number;
    isAvailable: boolean;
  }) {
    return {
      branchId: offer.branchId,
      variantId: offer.variantId,
      price: offer.price === null ? null : Number(offer.price),
      stockQuantity: offer.stockQuantity,
      reservedQuantity: offer.reservedQuantity,
      isAvailable: offer.isAvailable,
    };
  }

  private throwIfUniqueConstraint(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A catalog identifier already exists');
    }
  }

  private async withUniqueConflict<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }
}
