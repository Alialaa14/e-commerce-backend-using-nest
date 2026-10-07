import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from './stripe-constants';

@Injectable()
export class StripeService {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}

  construct(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, '');
  }
}
