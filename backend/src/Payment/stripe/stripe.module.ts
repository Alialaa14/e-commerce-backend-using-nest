import { Module } from '@nestjs/common';
import { STRIPE_CLIENT } from './stripe-constants';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
@Module({
  exports: [STRIPE_CLIENT, StripeService],
  imports: [],
  providers: [
    {
      provide: STRIPE_CLIENT,
      useFactory: (config: ConfigService) => {
        const stripeSecretKey = config.get<string>('STRIPE_TEST_SECRET_KEY');
        console.log(stripeSecretKey);
        if (!stripeSecretKey) {
          throw new Error('STRIPE_TEST_SECRET_KEY is not defined');
        }
        return new Stripe(stripeSecretKey, { apiVersion: '2026-08-26.dahlia' });
      },
      inject: [ConfigService],
    },
    StripeService,
  ],
  controllers: [],
})
export class StripeModule {}
