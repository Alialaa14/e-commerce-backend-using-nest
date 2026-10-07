import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartModel } from './cart.model';
import { VariantService } from '../Variants/variant.service';

@Injectable()
export class CartService {
  constructor(
    private readonly cartModel: CartModel,
    private readonly variantService: VariantService,
  ) {}

  private async checkCartExisence(userId: string) {
    const cart = await this.cartModel.getCartByUserId(userId);
    if (!cart) {
      return this.cartModel.createCart({ userId });
    }
    return cart;
  }

  private getCartProducts(cartId: string) {
    return this.cartModel.getCartProducts(cartId);
  }
  private calulcateTotalPrice(
    cartItems: {
      quantity: number;
      price: number;
    }[],
    discount: number,
  ) {
    const price = cartItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    return {
      price,
      totalPrice: price - price * (discount / 100),
    };
  }

  async addProductToCart(
    userId: string,
    productId: string,
    variant: {
      size: string;
      color: string;
    },
  ) {
    // First Check if the cart exists if not create it
    const cart = await this.checkCartExisence(userId);
    const productVariant = await this.variantService.getVariant(
      productId,
      variant.color,
      variant.size,
    );
    if (!productVariant)
      throw new NotFoundException('Product Variant not found');
    if (productVariant.isDeleted)
      throw new BadRequestException('Variant is deleted');
    if (productVariant.product.isDeleted)
      throw new BadRequestException('Product is deleted');
    // Create Cart Product

    // Check if the Product Is Already on cart or not if not add it if it is already on cart then increase the quantity
    const cartItems = await this.getCartProducts(cart?.id!);
    if (
      cartItems.some(
        (item) =>
          item.variant.product.brandId !== productVariant.product.brandId,
      )
    ) {
      throw new BadRequestException(
        'Cart can only contain products from the same brand',
      );
    }
    const cartItem = cartItems.find(
      (item) => item.variantId === productVariant.id,
    );

    if (!cartItem) {
      await this.cartModel.createCartProduct(cart?.id!, productVariant.id, {
        quantity: 1,
        price: productVariant.product.price,
      });
    } else {
      await this.cartModel.updateProductsCartCount(
        cart?.id!,
        productVariant.id,
        'plus',
      );
    }

    const cartItemsAfterUpdate = await this.getCartProducts(cart?.id!);
    const { price, totalPrice } = this.calulcateTotalPrice(
      cartItemsAfterUpdate,
      cart?.discount!,
    );
    return await this.cartModel.updateCart(cart?.id!, { price, totalPrice });
  }
  async getCart(userId: string) {
    const cart = await this.cartModel.getCartByUserId(userId);
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  async clearCart(userId: string) {
    const cart = await this.getCart(userId);
    if (!cart) throw new NotFoundException('Cart not found');
    // clear cart
    await this.cartModel.clearCart(cart.id);
    // Remove all cart products
    if (cart.products.length > 0) {
      await this.cartModel.deleteCartProduct(cart.id);
    }
    return cart;
  }

  async updateCart(
    userId: string,
    data: {
      cartNote?: string;
      discount?: number;
      userLocation?: string;
      userNumber?: string;
    },
  ) {
    const cart = await this.getCart(userId);
    if (!cart) throw new NotFoundException('Cart not found');
    return await this.cartModel.updateCart(cart.id, data);
  }

  async updateProductsCartCount(
    userId: string,
    variantId: string,
    action: 'plus' | 'minus',
  ) {
    const cart = await this.getCart(userId);
    if (!cart) throw new NotFoundException('Cart not found');
    const variant = await this.variantService.getVariantByid(variantId);
    if (!variant) throw new NotFoundException('Variant not found');
    const productsInCart = await this.getCartProducts(cart.id);
    const product = productsInCart.find((item) => item.variantId === variantId);
    if (!product) throw new NotFoundException('Product not found in cart');

    if (action === 'plus' && product.quantity >= variant.stock) {
      throw new BadRequestException('Product is out of stock');
    }
    if (action === 'minus' && product.quantity <= 1) {
      throw new BadRequestException('Product quantity cannot be less than 1');
    }

    await this.cartModel.updateProductsCartCount(cart.id, variantId, action);
  }
  // todo : update schema of cart to add created At and Updated At
  async getCarts(
    paginateOpts: {
      page: number;
      take: number;
    },
    queryOpts: {
      [key: string]: string;
    },
    // orderBy: {
    //   [key: string]: string;
    // },
  ) {
    const skip = (paginateOpts.page - 1) * paginateOpts.take;
    return this.cartModel.getCarts(
      { skip, take: paginateOpts.take },
      queryOpts,
      // orderBy,
    );
  }
}
