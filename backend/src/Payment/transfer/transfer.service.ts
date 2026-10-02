import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { STRIPE_CLIENT } from '../stripe/stripe-constants';
import Stripe, { ApiList, Transfer } from 'stripe';
import { PrismaService } from '../../utils/prisma/prisma.service';

@Injectable()
export class TransferService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
  ) {}

  async createTransfer(payload: {
    amount: number;
    currency: string;
    destination: string;
    orderId: string;
  }): Promise<Stripe.Response<Stripe.Transfer>> {
    // check if the order exists and is paid

    //todo : customize the order model to have payment status
    const order = await this.prisma.prisma.order.findFirst({
      where: {
        orderId: payload.orderId,
        status: 'delivered',
        // todo : check if the order is paid or not
      },
    });

    if (!order) throw new NotFoundException('Order not found or not delivered');

    const transfer = await this.stripe.transfers.create({
      amount: payload.amount,
      currency: payload.currency,
      destination: payload.destination,
      transfer_group: `ORDER_${payload.orderId}`,
      metadata: {
        orderId: payload.orderId,
      },
    });

    if (!transfer) throw new BadGatewayException('Transfer failed');

    return transfer;
  }

  async updateTransfer(
    transferId: string,
    payload: { metadata: Record<string, string> },
  ): Promise<Stripe.Response<Stripe.Transfer>> {
    const transfer = await this.stripe.transfers.update(transferId, {
      metadata: payload.metadata,
    });

    if (!transfer) throw new BadGatewayException('Transfer update failed');

    return transfer;
  }

  async getTransfer(
    transferId: string,
  ): Promise<Stripe.Response<Stripe.Transfer>> {
    const transfer = await this.stripe.transfers.retrieve(transferId);
    return transfer;
  }

  async getTransfers(
    limit: number,
  ): Promise<Stripe.Response<ApiList<Stripe.Transfer>>> {
    const transfers = await this.stripe.transfers.list({
      limit: limit,
    });

    return transfers;
  }
}
