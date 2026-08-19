import { Controller, Post, Req, UseInterceptors } from '@nestjs/common';
import { ProductService } from './product.service';
import { MulterService } from '../utils/multer/multer.service';
import type { FastifyRequest } from 'fastify';
import { FastifyFileInterceptor } from '../utils/multer/multer.interceptor';
import { UploadedFastifyFile } from '../utils/multer/multer-file.decorator';

@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly MulterSErvice: MulterService,
  ) {}

  @Post('/import')
  @UseInterceptors(FastifyFileInterceptor)
  async importBulkProducts(@UploadedFastifyFile() file: any) {
    const filePath =
      file && (await this.MulterSErvice.saveToDisk(file, 'products'));
    return this.productService.importBulkProducts(filePath);
  }
}
