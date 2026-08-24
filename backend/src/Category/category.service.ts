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
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { MulterService } from '../utils/multer/multer.service';

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryModel: CategoryModel,
    private readonly cloudinaryService: CloudinaryService,
    private readonly multerService: MulterService,
  ) {}

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
    filePath?: string;
  }) {
    let media: { secure_url: string; public_id: string } | undefined;
    try {
      const existing = await this.categoryModel.getCategories({
        search: data.name,
        take: 1,
        skip: 0,
      });

      const duplicate = existing.data.find((item) => item.name === data.name);
      if (duplicate) {
        throw new BadRequestException(`Category "${data.name}" already exists`);
      }
      if (!data.filePath) {
        throw new BadRequestException('Media is required');
      }
      if (data.filePath) {
        const upload = await this.cloudinaryService.uploadToCloudinary(
          data.filePath,
          `categories/${data.name}`,
        );
        media = {
          secure_url: upload.secure_url,
          public_id: upload.public_id,
        };
      }
      return await this.categoryModel.createCategory({
        name: data.name,
        description: data.description,
        media: media ?? {},
      });
    } catch {
      throw new InternalServerErrorException('Failed to create category');
    } finally {
      await this.multerService.deleteFile(data.filePath);
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
