import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ProductModel } from './product.model';
import { ProductQueueService } from '../Queues/ProductQueues/product.queue.service';
import { VariantService } from '../Variants/variant.service';
import { BrandService } from '../Brand/brand.service';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { CategoryService } from '../Category/category.service';
import { MulterService } from '../utils/multer/multer.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly productModel: ProductModel,
    private readonly ProductQueueService: ProductQueueService,
    private readonly variantService: VariantService,
    private readonly brandService: BrandService,
    private readonly categoryService: CategoryService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly multerService: MulterService,
  ) {}

  private queryHandler(query: any) {
    let where: { [key: string]: any } = {};
    if (query.brandId) {
      where.brandId = query.brandId;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.available) {
      where.available = query.available;
    }

    if (query?.price?.gte) {
      where.price = {
        gte: query.price.gte,
      };
    }
    if (query?.price?.lte) {
      where.price = {
        lte: query.price.lte,
      };
    }
    if (query?.price?.gt) {
      where.price = {
        gt: query.price.gt,
      };
    }
    if (query?.price?.lt) {
      where.price = {
        lt: query.price.lt,
      };
    }
    if (query.price) where.price = query.price;
    if (query.search)
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];

    return where;
  }
  // Create Product With Atleast One Variant And One Media
  async createProduct(data: {
    name: string;
    description: string;
    brandId: string;
    media: {
      filePath: string;
    }[];
    categoryId: string;
    price: number;
    discount?: number;
    available?: boolean;
    variants: {
      color: string;
      size: string;
      stock: number;
    }[];
  }) {
    // Check if There is no media (file paths) atleast one media is required
    if (data.media.length === 0) {
      throw new BadRequestException('Atleast one media is required');
    }
    if (data.media.length > 5) {
      throw new BadRequestException('Maximum 5 media is allowed');
    }
    // Check if There is no variants provided atleast one variant is required
    if (data.variants.length === 0) {
      throw new BadRequestException('Atleast one variant is required');
    }

    // Check if the Price is greater than 0
    if (data.price <= 0) {
      throw new BadRequestException('Price must be greater than 0');
    }
    // Check if the discount is between 0 and 100
    if (data.discount && (data.discount < 0 || data.discount > 100)) {
      throw new BadRequestException('Discount must be between 0 and 100');
    }

    // Check if the brand is existed or not
    const brand = await this.brandService.getBrandByCondition({
      id: data.brandId,
    });
    if (!brand) throw new BadRequestException('Brand not found');

    // Check if the category is existed or not
    const category = await this.categoryService.getCategoryById(
      data.categoryId,
    );
    if (!category) throw new BadRequestException('Category not found');
    let uploadMedia: { secure_url: string; public_id: string }[] = [];
    try {
      if (data.media.length > 0) {
        uploadMedia = await Promise.all(
          data.media.map(async (media) => {
            return await this.cloudinaryService.uploadToCloudinary(
              media.filePath,
              `${brand.name}/${category.name}/${data.name}/media`,
            );
          }),
        );
      }
    } catch (error) {
      //TODO :  Question : If Error happends while uploading media, how to handle it ? (Remove all uploaded media ? )
      throw new BadRequestException(
        `Failed to upload media: ${(error as Error).message}`,
      );
    } finally {
      Promise.all(
        data.media.map(async (media) => {
          return await this.multerService.deleteFile(media.filePath);
        }),
      );
    }

    // Create Product
    const product = await this.productModel.createProduct({
      name: data.name,
      description: data.description,
      brandId: data.brandId,
      media: uploadMedia,
      categoryId: data.categoryId,
      price: data.price,
      discount: data.discount,
      available: data.available,
    });

    await this.variantService.createVariants(product.id, data.variants);

    return product;
  }
  //todo => Impelement Service of Import Bulk Products
  async importBulkProducts(filePath: string) {
    return this.ProductQueueService.addToQueue(filePath);
  }

  // Soft Delete Product
  async softDeleteProduct(id: string, userId: string, userRole: string) {
    const product = await this.productModel.getProductById(id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (userRole !== 'admin' && product.brand.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this product',
      );
    }

    if (product.isDeleted) {
      throw new BadRequestException('Product is already deleted');
    }

    return this.productModel.softDeleteProduct(id);
  }

  // update Product
  async updateProduct(
    id: string,
    data: {
      name?: string;
      description?: string;
      brandId?: string;
      categoryId?: string;
      price?: number;
      discount?: number;
      available?: boolean;
    },
  ) {
    const product = await this.productModel.getProductById(id);
    if (!product) throw new NotFoundException('Product not found');
    if (data.brandId !== product.brand.brandId) {
      throw new ForbiddenException(
        'You are not authorized to update this product',
      );
    }
    return this.productModel.updateProduct(id, data);
  }
  async getProductsByBrandId(
    brandId: string,
    paginateOpts: { skip: number; take: number },
    queryOpts: { [key: string]: string },
    orderBy: { [key: string]: string },
  ) {
    const brand = await this.brandService.getBrandByCondition({ id: brandId });
    if (!brand) throw new BadRequestException('Brand not found');
    const query = this.queryHandler(queryOpts);
    return this.productModel.getProductsByBrandId(
      brandId,
      paginateOpts,
      query,
      orderBy,
    );
  }

  async getProductsCategory(
    categId: string,
    paginateOpts: { skip: number; take: number },
    queryOpts: { [key: string]: string },
    orderBy: { [key: string]: string },
  ) {
    const category = await this.categoryService.getCategoryById(categId);
    if (!category) throw new BadRequestException('Category not found');
    const query = this.queryHandler(queryOpts);
    return this.productModel.getProductsCategory(
      categId,
      paginateOpts,
      query,
      orderBy,
    );
  }

  async getProducts(
    paginateOpts: { skip: number; take: number },
    queryOpts: { [key: string]: string },
    orderBy: { [key: string]: string },
  ) {
    const query = this.queryHandler(queryOpts);
    console.log(query);
    return this.productModel.getProducts(paginateOpts, query, orderBy);
  }

  async getProduct(productId: string) {
    await this.productModel.updateProduct(productId, {
      viewCount: { increment: 1 },
    });
    return this.productModel.getProduct(productId);
  }

  async uploadProductPictures(media: [any], productId: string) {
    const product = await this.productModel.getProduct(productId);
    if (!product) throw new NotFoundException('Product not found');
    if (product.isDeleted) throw new BadRequestException('Product is deleted');
    if (media.length + product.media.length > 5)
      throw new BadRequestException('Maximum 5 media is allowed');

    let filePaths: { filePath: string }[] = [];

    if (media.length > 0) {
      filePaths = await Promise.all(
        media.map(async (file: any) => {
          return {
            filePath: await this.multerService.saveToDisk(file, 'products'),
          };
        }),
      );
    }
    const result = await Promise.all(
      filePaths.map(async (file: { filePath: string }) => {
        console.log(file.filePath);
        return await this.cloudinaryService.uploadToCloudinary(
          file.filePath,
          `${product.brandId}/products/${product.name}`,
        );
      }),
    );
    console.log(result);
    const filteredData = result.map((res) => {
      return {
        public_id: res.public_id,
        secure_url: res.secure_url,
      };
    });

    return this.productModel.uploadPictures(filteredData, productId);
  }

  async deletePictures(pics: { public_id: string }[], id: string) {
    const product = await this.productModel.getProduct(id);
    if (!product) throw new NotFoundException('Product not found');
    if (product.isDeleted) throw new BadRequestException('Product is deleted');
    if (product.media.length - pics.length < 1)
      throw new BadRequestException('Atleast one media is required');

    try {
      await Promise.all(
        pics.map(async (pic: { public_id: string }) => {
          await this.cloudinaryService.deleteFromCloudinary(pic.public_id);
        }),
      );
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Cloudinary Delete failed');
    }

    const filteredPics = product.media.filter((media: any) => {
      return !pics.find((pic) => pic.public_id === media?.public_id!);
    });

    return this.productModel.updateProduct(id, { media: filteredPics });
  }
}
