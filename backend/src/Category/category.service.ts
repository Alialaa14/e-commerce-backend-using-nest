import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  CategoryFilter,
  CategoryModel,
  CategoryResult,
} from './category.model';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryModel: CategoryModel) {}

  async getCategories(filter: CategoryFilter): Promise<CategoryResult<any>> {
    return this.categoryModel.getCategories(filter);
  }

  async getCategoryById(id: string) {
    const category = await this.categoryModel.getCategoryById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async createCategory(data: {
    name: string;
    description: string;
    media?: any;
  }) {
    const existing = await this.categoryModel.getCategories({
      search: data.name,
      take: 1,
      skip: 0,
    });

    const duplicate = existing.data.find((item) => item.name === data.name);
    if (duplicate) {
      throw new BadRequestException(`Category "${data.name}" already exists`);
    }

    try {
      return await this.categoryModel.createCategory({
        name: data.name,
        description: data.description,
        media: data.media ?? {},
      });
    } catch {
      throw new InternalServerErrorException('Failed to create category');
    }
  }

  async updateCategory(id: string, data: Record<string, any>) {
    await this.getCategoryById(id);

    if (data.name) {
      const existing = await this.categoryModel.getCategories({
        search: data.name,
        take: 1,
        skip: 0,
      });

      const duplicate = existing.data.find(
        (item) => item.name === data.name && item.id !== id,
      );

      if (duplicate) {
        throw new BadRequestException(`Category "${data.name}" already exists`);
      }
    }

    try {
      return await this.categoryModel.updateCategory(id, data);
    } catch {
      throw new InternalServerErrorException('Failed to update category');
    }
  }

  async deleteCategory(id: string, soft = true) {
    await this.getCategoryById(id);

    try {
      return await this.categoryModel.deleteCategory(id, soft);
    } catch {
      throw new InternalServerErrorException('Failed to delete category');
    }
  }

  async toggleVisibility(id: string) {
    await this.getCategoryById(id);

    try {
      return await this.categoryModel.toggleVisibility(id);
    } catch {
      throw new InternalServerErrorException(
        'Failed to toggle category visibility',
      );
    }
  }
}
