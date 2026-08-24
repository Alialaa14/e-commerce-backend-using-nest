import {
  Post,
  UseGuards,
  Controller,
  Req,
  Body,
  Get,
  Delete,
  Patch,
  Put,
  Query,
  Param,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AddToCartDto } from './dto/add-to-cart-dto';
import { updateCartDto } from './dto/update-cart-dto';
import { getAllCartsDto } from './dto/get-all-carts.dto';
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('/')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async AddToCart(@Req() req: any, @Body() dto: AddToCartDto) {
    const userId = req.user.sub;

    const cart = await this.cartService.addProductToCart(
      userId,
      dto.productId,
      dto.variant,
    );
    return {
      success: true,
      message: 'Product added to cart successfully',
      data: cart,
    };
  }

  @Get('/')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async getCart(@Req() req: any) {
    const userId = req.user.sub;
    const cart = await this.cartService.getCart(userId);
    return {
      success: true,
      message: 'Cart retrieved successfully',
      data: cart,
    };
  }
  @Delete()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async clearCart(@Req() req: any) {
    const userId = req.user.sub;
    const cart = await this.cartService.clearCart(userId);
    return {
      success: true,
      message: 'Cart cleared successfully',
      data: cart,
    };
  }

  @Patch()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async updateCart(@Req() req: any, @Body() dto: updateCartDto) {
    const userId = req.user.sub;
    const cart = await this.cartService.updateCart(userId, dto);
    return {
      success: true,
      message: 'Cart updated successfully',
      data: cart,
    };
  }

  @Put('/:variantId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async updateProductCartCount(
    @Req() req: any,
    @Param('variantId') variantId: string,
    @Query('opt') opt: 'plus' | 'minus',
  ) {
    const userId = req.user.sub;
    const cart = await this.cartService.updateProductsCartCount(
      userId,
      variantId,
      opt,
    );
    return {
      success: true,
      message: 'Cart updated successfully',
      data: cart,
    };
  }

  @Get('/all')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async getAllCart(@Query() query: getAllCartsDto) {
    const {
      page = 1,
      limit = 10,
      orderBy = 'createdAt',
      orderType = 'desc',
    } = query;
    const cart = await this.cartService.getCarts(
      {
        page: Number(page),
        take: Number(limit),
      },
      { userId: query?.userId! },
      // { [orderBy]: orderType },
    );
    return {
      success: true,
      message: 'Cart retrieved successfully',
      data: cart,
    };
  }
}
