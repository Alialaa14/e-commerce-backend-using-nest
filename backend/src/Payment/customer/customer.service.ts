import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { STRIPE_CLIENT } from '../stripe/stripe-constants';
import Stripe from 'stripe';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { Prisma, User } from '../../generated/prisma';

@Injectable()
export class CustomerService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prismaService: PrismaService,
  ) {}

  async createCustomer(userId: string): Promise<any> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    const stripeCustomer = await this.stripe.customers.create({
      email: user.email,
      name: user.username,
      phone: user.phone!,
      metadata: {
        userId: user.id,
      },
    });

    console.log(stripeCustomer);

    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: { providerCustomerId: stripeCustomer.id, provider: 'stripe' },
    });
  }

  async updateCustomer(userId: string, stripeCustomerId: string) {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId, providerCustomerId: stripeCustomerId },
    });
    if (!user) throw new NotFoundException('User not found');

    const updatedCustomer = await this.stripe.customers.update(
      stripeCustomerId,
      {
        email: user.email,
        name: user.username,
        phone: user.phone!,
        metadata: {
          userId: user.id,
        },
      },
    );
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: { providerCustomerId: updatedCustomer.id },
    });
  }

  async getCustomer(userId: string): Promise<any> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.stripe.customers.retrieve(user.providerCustomerId!);
  }
}
