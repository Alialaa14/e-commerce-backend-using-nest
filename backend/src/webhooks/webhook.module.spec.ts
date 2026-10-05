import { Test } from '@nestjs/testing';
import { STRIPE_CLIENT } from '../Payment/stripe/stripe-constants';
import { WebhookController } from './webhook.controller';
import { WebhookModule } from './webhook.module';

describe('WebhookModule', () => {
  it('resolves StripeService for WebhookController', async () => {
    const stripe = { webhooks: { constructEvent: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      imports: [WebhookModule],
    })
      .overrideProvider(STRIPE_CLIENT)
      .useValue(stripe)
      .compile();

    expect(moduleRef.get(WebhookController)).toBeDefined();
  });
});
