import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseInterceptors,
  UseGuards,
  Patch,
  Get,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { MulterService } from '../utils/multer/multer.service';
import type { FastifyRequest } from 'fastify';
import { MultipartInterceptor } from '../utils/multer/multer.interceptor';
import { UploadedFastifyFile } from '../utils/multer/multer-file.decorator';
import { createProductDto } from './dto/createProducts.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DeleteProductDto } from './dto/delete-product.dto';
import { BrandService } from '../Brand/brand.service';
import { getProductDto } from './dto/get-product.dto';
import {
  getProductsCategoryParamsDto,
  getProductsCategoryQueryDto,
} from './dto/get-products-category.dto';
import { paginate } from '../helpers/paginate';
import {
  updateProductDto,
  updateProductParamDto,
} from './dto/update-product.dto';
import { DeleteProductPicsDto } from './dto/delete-product-pics-dto';

@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly MulterSErvice: MulterService,
    private readonly brandService: BrandService,
  ) {}
  @Post('/')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand')
  @UseInterceptors(MultipartInterceptor)
  async createProduct(
    @UploadedFastifyFile() files: any,
    @Req() req: FastifyRequest,
    @Body() dto: createProductDto,
  ) {
    const payload = (req as any).user;
    const userId = payload?.sub;
    const brand = await this.brandService.getBrandByCondition({ userId });
    if (!brand) throw new BadRequestException('Brand not found');
    let filePaths: { filePath: string }[];

    if (typeof dto.variants === 'string') {
      dto.variants = JSON.parse(dto.variants);
    }

    if (files && files.length > 0) {
      filePaths = await Promise.all(
        files.map(async (file: any) => {
          return {
            filePath: await this.MulterSErvice.saveToDisk(file, 'products'),
          };
        }),
      );

      return this.productService.createProduct({
        ...dto,
        brandId: brand?.id,
        media: filePaths,
      });
    }
  }

  // todo : Implement Bulk Product Import With BullMq and Redis
  @Post('/import')
  @UseInterceptors(MultipartInterceptor)
  async importBulkProducts(@UploadedFastifyFile() file: any) {
    const filePath =
      file && (await this.MulterSErvice.saveToDisk(file, 'products'));
    return this.productService.importBulkProducts(filePath);
  }

  @Get('/:id')
  async getProductById(@Param('id') dto: getProductDto) {
    const product = await this.productService.getProduct(dto.id);
    return {
      success: true,
      message: 'Product fetched successfully',
      data: product,
    };
  }

  @Get('/category/:id')
  async getProductsByCategory(@Param() params: any, @Query() query: any) {
    const {
      page = 1,
      limit = 10,
      orderBy = 'createdAt',
      order = 'desc',
    } = query;
    const { skip, take } = paginate(Number(page), Number(limit));

    const products = await this.productService.getProductsCategory(
      params.id,
      { skip, take },
      query,
      { [orderBy]: order },
    );

    if (!products || products.length === 0)
      throw new NotFoundException('Product not found');
    return {
      success: true,
      message: 'Products fetched successfully',
      data: products,
    };
  }

  @Get()
  async getProducts(@Query() query: any) {
    const {
      page = 1,
      limit = 10,
      orderBy = 'createdAt',
      order = 'desc',
    } = query;
    const { skip, take } = paginate(Number(page), Number(limit));

    const products = await this.productService.getProducts(
      { skip, take },
      query,
      { [orderBy]: order },
    );
    console.log(products);
    if (!products || products.length === 0)
      throw new NotFoundException('Product not found');
    return {
      success: true,
      message: 'Products fetched successfully',
      data: products,
    };
  }

  @Get('/brand/:id')
  async getProductsByBrandId(@Param() params: any, @Query() query: any) {
    const {
      page = 1,
      limit = 10,
      orderBy = 'createdAt',
      order = 'desc',
    } = query;
    const { skip, take } = paginate(Number(page), Number(limit));

    const products = await this.productService.getProductsByBrandId(
      params.id,
      { skip, take },
      query,
      { [orderBy]: order },
    );
    if (!products || products.length === 0)
      throw new NotFoundException('Product not found');
    return {
      success: true,
      message: 'Products fetched successfully',
      data: products,
    };
  }

  @Delete('/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand')
  async softDeleteProduct(
    @Param() params: DeleteProductDto,
    @Req() req: FastifyRequest,
  ) {
    const user = (req as any).user;
    const product = await this.productService.softDeleteProduct(
      params.productId,
      user.sub,
      user.role,
    );

    return {
      success: true,
      message: 'Product deleted successfully',
      data: product,
    };
  }

  @Patch('/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand')
  async updateProduct(@Param('id') id: string, @Body() data: updateProductDto) {
    const updatedProduct = await this.productService.updateProduct(id, data);
    return {
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct,
    };
  }

  @Post('/:id/pictures')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand')
  @UseInterceptors(MultipartInterceptor)
  async uploadPictures(
    @UploadedFastifyFile() file: [any],
    @Param('id') id: string,
  ) {
    const uploadedPics = await this.productService.uploadProductPictures(
      [...file],
      id,
    );
    return {
      success: true,
      message: 'Product pictures uploaded successfully',
      data: uploadedPics,
    };
  }
  @Delete('/:id/pictures')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand')
  async deletePictures(
    @Body() dto: DeleteProductPicsDto,
    @Param('id') id: string,
  ) {
    console.log(dto.file);
    const deletedPics = await this.productService.deletePictures(dto.file, id);
    return {
      success: true,
      message: 'Product pictures Deleted successfully',
      data: deletedPics,
    };
  }
}
