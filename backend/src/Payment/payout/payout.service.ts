import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import Stripe, { type ApiList } from 'stripe';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { STRIPE_CLIENT } from '../stripe/stripe-constants';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { PayoutListQueryDto } from './dto/payout-list-query.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';

@Injectable()
export class PayoutService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
  ) {}

  async createPayout(
    userId: string,
    payload: CreatePayoutDto,
    idempotencyKey: string,
  ): Promise<Stripe.Response<Stripe.Payout>> {
    if (!isUUID(idempotencyKey, '4')) {
      throw new BadRequestException(
        'A valid UUID v4 Idempotency-Key header is required',
      );
    }

    const stripeAccount = await this.getConnectedAccountId(userId);
    return this.stripe.payouts.create(payload, {
      stripeAccount,
      idempotencyKey,
    });
  }

  async getPayouts(
    userId: string,
    query: PayoutListQueryDto,
  ): Promise<Stripe.Response<ApiList<Stripe.Payout>>> {
    if (query.starting_after && query.ending_before) {
      throw new BadRequestException(
        'Use starting_after or ending_before, not both',
      );
    }

    const stripeAccount = await this.getConnectedAccountId(userId);
    return this.stripe.payouts.list(query, { stripeAccount });
  }

  async getPayout(
    userId: string,
    payoutId: string,
  ): Promise<Stripe.Response<Stripe.Payout>> {
    const stripeAccount = await this.getConnectedAccountId(userId);
    return this.stripe.payouts.retrieve(payoutId, {}, { stripeAccount });
  }

  async updatePayout(
    userId: string,
    payoutId: string,
    payload: UpdatePayoutDto,
  ): Promise<Stripe.Response<Stripe.Payout>> {
    const stripeAccount = await this.getConnectedAccountId(userId);
    return this.stripe.payouts.update(payoutId, payload, { stripeAccount });
  }

  async cancelPayout(
    userId: string,
    payoutId: string,
  ): Promise<Stripe.Response<Stripe.Payout>> {
    const stripeAccount = await this.getConnectedAccountId(userId);
    return this.stripe.payouts.cancel(payoutId, {}, { stripeAccount });
  }

  private async getConnectedAccountId(userId: string): Promise<string> {
    const user = await this.prisma.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, accountId: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'brand' && user.role !== 'delievryC') {
      throw new ForbiddenException('This account cannot manage payouts');
    }
    if (!user.accountId) {
      throw new NotFoundException('Connected Stripe account not found');
    }

    return user.accountId;
  }
}
