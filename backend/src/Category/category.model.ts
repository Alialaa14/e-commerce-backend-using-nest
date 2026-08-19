import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';

export interface CategoryFilter {
  search?: string;
  skip?: number;
  take?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isHidden?: boolean;
}

export interface CategoryResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class CategoryModel {
  constructor(private readonly prismaService: PrismaService) {}

  private buildWhereClause(filter: CategoryFilter) {
    const where: any = {};

    if (filter.isHidden === undefined || filter.isHidden === false) {
      where.ishidden = false;
    }

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async getCategories(filter: CategoryFilter): Promise<CategoryResult<any>> {
    const where = this.buildWhereClause(filter);
    const take = filter.take ?? 10;
    const skip = filter.skip ?? 0;

    const [total, data] = await Promise.all([
      this.prismaService.prisma.category.count({ where }),
      this.prismaService.prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: filter.sortBy
          ? { [filter.sortBy]: filter.sortOrder ?? 'asc' }
          : { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async getCategoryById(id: string) {
    return this.prismaService.prisma.category.findUnique({
      where: { id },
    });
  }

  async createCategory(data: {
    name: string;
    description: string;
    media: any;
  }) {
    return this.prismaService.prisma.category.create({ data });
  }

  async updateCategory(id: string, data: Record<string, any>) {
    return this.prismaService.prisma.category.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: string, soft = true) {
    if (soft) {
      return this.prismaService.prisma.category.update({
        where: { id },
        data: { ishidden: true },
      });
    }

    return this.prismaService.prisma.category.delete({
      where: { id },
    });
  }

  async toggleVisibility(id: string) {
    const category = await this.getCategoryById(id);
    return this.prismaService.prisma.category.update({
      where: { id },
      data: { ishidden: !category?.ishidden },
    });
  }
}
