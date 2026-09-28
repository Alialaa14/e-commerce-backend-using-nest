import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { STRIPE_CLIENT } from '../stripe/stripe-constants';
import Stripe from 'stripe';

@Injectable()
export class SetupIntentService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prismaService: PrismaService,
  ) {}

  async createSetupIntent(userId: string): Promise<any> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const setupIntent = await this.stripe.setupIntents.create({
      customer: user.providerCustomerId!,
      automatic_payment_methods: {
        allow_redirects: 'always',
        enabled: true,
      },
      metadata: {
        userId: user.id,
      },
      usage: 'off_session',
    });

    return setupIntent;
  }
}
