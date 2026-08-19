import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @UseGuards(AuthGuard)
  async getCategories(@Query() query: GetCategoriesQueryDto) {
    const {
      search = '',
      limit = 10,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const result = await this.categoryService.getCategories({
      search,
      skip,
      take: limit,
      sortBy,
      sortOrder,
    });

    return {
      success: true,
      message: 'OK',
      data: {
        categories: result.data,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getCategoryById(@Param('id') id: string) {
    const category = await this.categoryService.getCategoryById(id);

    return {
      success: true,
      message: 'OK',
      data: { category },
    };
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.categoryService.createCategory({
      name: dto.name,
      description: dto.description,
      media: dto.media,
    });

    return {
      success: true,
      message: 'Category created successfully',
      data: { category },
    };
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const category = await this.categoryService.updateCategory(id, {
      name: dto.name,
      description: dto.description,
      media: dto.media,
      ishidden: dto.isHidden,
    });

    return {
      success: true,
      message: 'Category updated successfully',
      data: { category },
    };
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async deleteCategory(@Param('id') id: string) {
    await this.categoryService.deleteCategory(id);

    return {
      success: true,
      message: 'Category deleted successfully',
    };
  }

  @Patch(':id/toggle')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async toggleVisibility(@Param('id') id: string) {
    const category = await this.categoryService.toggleVisibility(id);

    return {
      success: true,
      message: 'Category visibility toggled',
      data: { category },
    };
  }
}
