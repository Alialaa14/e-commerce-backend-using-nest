import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../utils/prisma/prisma.service';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../stripe/stripe-constants';
import { User } from '../../generated/prisma';

@Injectable()
export class AccountService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
  ) {}

  async createAccount(userId: string): Promise<object> {
    const user = await this.prisma.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.accountId) return { id: user.accountId }; // already created

    const isSeller = user.role === 'brand' || user.role === 'delievryC';
    const isBuyer = user.role === 'user';
    if (!isSeller && !isBuyer)
      throw new BadRequestException('Unsupported role');

    const base = {
      contact_email: user.email,
      ...(user.phone && { contact_phone: user.phone }),
      display_name: user.username,
      metadata: { userId: user.id },
    };

    const payload = isSeller
      ? {
          ...base,
          dashboard: 'none',
          identity: { country: 'eg', entity_type: 'company' }, // confirm support
          defaults: {
            currency: 'egp',
            locales: ['ar-SA', 'en-US'],
            responsibilities: {
              fees_collector: 'application',
              losses_collector: 'application',
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: { stripe_transfers: { requested: true } },
              },
            },
          },
          include: ['configuration.recipient'],
        }
      : {
          ...base, // no dashboard for customer-only accounts
          identity: { country: 'eg' }, // confirm support
          defaults: { currency: 'egp', locales: ['ar-SA', 'en-US'] },
          configuration: { customer: {} },
          include: ['configuration.customer'],
        };

    const account = await this.stripe.v2.core.accounts.create(payload as any);

    await this.prisma.prisma.user.update({
      where: { id: userId },
      data: { accountId: account.id },
    });

    return account;
  }

  async updateAccount(userId: string): Promise<object> {
    const user = await this.prisma.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.accountId)
      throw new BadRequestException('Account not created yet');

    const isSeller = user.role === 'brand' || user.role === 'delievryC';
    const isBuyer = user.role === 'user';
    if (!isSeller && !isBuyer)
      throw new BadRequestException('Unsupported role');

    const base = {
      contact_email: user.email,
      ...(user.phone && { contact_phone: user.phone }),
      display_name: user.username,
      metadata: { userId: user.id },
    };

    const payload = isSeller
      ? {
          ...base,
          dashboard: 'none',
          identity: { country: 'eg', entity_type: 'company' }, // confirm support
          defaults: {
            currency: 'egp',
            locales: ['ar-SA', 'en-US'],
            responsibilities: {
              fees_collector: 'application',
              losses_collector: 'application',
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: { stripe_transfers: { requested: true } },
              },
            },
          },
          include: ['configuration.recipient'],
        }
      : {
          ...base, // no dashboard for customer-only accounts
          identity: { country: 'eg' }, // confirm support
          defaults: { currency: 'egp', locales: ['ar-SA', 'en-US'] },
          configuration: { customer: {} },
          include: ['configuration.customer'],
        };

    const account = await this.stripe.v2.core.accounts.update(
      user.accountId!,
      payload as any,
    );
    return account;
  }

  async getAccount(userId: string): Promise<object> {
    const user = await this.prisma.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.accountId)
      throw new BadRequestException('Account not created yet');

    const account = await this.stripe.v2.core.accounts.retrieve(
      user.accountId!,
    );
    return account;
  }

  async getAccounts(): Promise<object[]> {
    const users = await this.prisma.prisma.user.findMany({
      where: { accountId: { not: null } },
    });

    if (!users || users.length === 0)
      throw new NotFoundException('No users with accounts found');

    const accounts = await Promise.all(
      users.map(async (user) => {
        const account = await this.stripe.v2.core.accounts.retrieve(
          user.accountId!,
        );
        return account;
      }),
    );
    return accounts;
  }

  async closeAccount(userId: string): Promise<object> {
    const user = await this.prisma.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.accountId)
      throw new BadRequestException('Account not created yet');

    // get the configurations that are actually applied
    const current = await this.stripe.v2.core.accounts.retrieve(
      user.accountId,
      {
        include: [
          'configuration.customer',
          'configuration.recipient',
          'configuration.merchant',
        ],
      },
    );

    let closed;
    try {
      closed = await this.stripe.v2.core.accounts.close(user.accountId, {
        applied_configurations: current.applied_configurations, // e.g. ['recipient']
      });
    } catch (err) {
      // Stripe throws on failure, e.g. non-zero balance or pending transfers
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Could not close the account',
      );
    }

    await this.prisma.prisma.user.update({
      where: { id: userId },
      data: { accountId: null },
    });
    return closed;
  }
}
