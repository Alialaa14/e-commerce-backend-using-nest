import { Body, Controller, Post } from '@nestjs/common';
import { StripeService } from '../Payment/stripe/stripe.service';
import { PrismaService } from '../utils/prisma/prisma.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prismaService: PrismaService,
  ) {}
  @Post()
  async handleWebhook(@Body() body: any) {
    const event = this.stripeService.construct(body, '');
    switch (event.type) {
      case 'payment_intent.succeeded':
        // Handle successful payment intent
        break;
      case 'payment_intent.payment_failed':
        // Handle failed payment intent
        break;
      // Add more cases for other event types as needed

      case 'checkout.session.completed':
        // Handle checkout session completed

        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    console.log('Webhook received');
    // Handle the webhook event here
    return { message: 'Webhook received' };
  }
}
