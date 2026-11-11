import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { CheckoutService } from '../Checkout/Checkout.service';
import { StripeService } from '../Payment/stripe/stripe.service';

interface StripeWebhookRequest {
  rawBody?: Buffer;
}

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post()
  async handleWebhook(
    @Req() request: StripeWebhookRequest,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!request.rawBody || !signature) {
      throw new BadRequestException(
        'Stripe webhook body and signature are required',
      );
    }

    const event = this.stripeService.construct(request.rawBody, signature);
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded' ||
      event.type === 'checkout.session.async_payment_failed' ||
      event.type === 'checkout.session.expired' ||
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'charge.refunded'
    ) {
      await this.checkoutService.handleStripeCheckoutEvent(event);
    }

    return { message: 'Webhook received' };
  }
}
