import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import Stripe, { type ApiList } from 'stripe';
import { getCurrentUser } from '../../common/decorators/Current-user-decorator';
import type { AuthUser } from '../../common/decorators/Current-user-decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { PayoutListQueryDto } from './dto/payout-list-query.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';
import { PayoutService } from './payout.service';

@Controller('payouts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('brand', 'BRAND_ADMIN', 'delievryC')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post()
  createPayout(
    @getCurrentUser() user: AuthUser,
    @Body() payload: CreatePayoutDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<Stripe.Response<Stripe.Payout>> {
    return this.payoutService.createPayout(user.sub, payload, idempotencyKey);
  }

  @Get()
  getPayouts(
    @getCurrentUser() user: AuthUser,
    @Query() query: PayoutListQueryDto,
  ): Promise<Stripe.Response<ApiList<Stripe.Payout>>> {
    return this.payoutService.getPayouts(user.sub, query);
  }

  @Get(':payoutId')
  getPayout(
    @getCurrentUser() user: AuthUser,
    @Param('payoutId') payoutId: string,
  ): Promise<Stripe.Response<Stripe.Payout>> {
    return this.payoutService.getPayout(user.sub, payoutId);
  }

  @Patch(':payoutId')
  updatePayout(
    @getCurrentUser() user: AuthUser,
    @Param('payoutId') payoutId: string,
    @Body() payload: UpdatePayoutDto,
  ): Promise<Stripe.Response<Stripe.Payout>> {
    return this.payoutService.updatePayout(user.sub, payoutId, payload);
  }

  @Post(':payoutId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelPayout(
    @getCurrentUser() user: AuthUser,
    @Param('payoutId') payoutId: string,
  ): Promise<Stripe.Response<Stripe.Payout>> {
    return this.payoutService.cancelPayout(user.sub, payoutId);
  }
}
