import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { StripeModule } from '../Payment/stripe/stripe.module';
import { CheckoutModule } from '../Checkout/Checkout.module';

@Module({
  exports: [],
  imports: [StripeModule, CheckoutModule],
  providers: [],
  controllers: [WebhookController],
})
export class WebhookModule {}
