import { Injectable } from '@nestjs/common';
import { ProductModel } from './product.model';
import { ProductQueueService } from '../Queues/ProductQueues/product.queue.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly productModel: ProductModel,
    private readonly ProductQueueService: ProductQueueService,
  ) {}

  async importBulkProducts(filePath: string) {
    return this.ProductQueueService.addToQueue(filePath);
  }
}
