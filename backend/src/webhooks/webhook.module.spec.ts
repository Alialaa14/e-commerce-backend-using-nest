jest.mock('../User/user.service', () => ({
  UserService: class UserService {},
}));

import { Test } from '@nestjs/testing';
import { CheckoutService } from '../Checkout/Checkout.service';
import { StripeService } from '../Payment/stripe/stripe.service';
import { WebhookController } from './webhook.controller';

describe('WebhookController dependencies', () => {
  it('resolves StripeService and CheckoutService', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: StripeService, useValue: { construct: jest.fn() } },
        { provide: CheckoutService, useValue: { placeOrder: jest.fn() } },
      ],
    }).compile();

    expect(moduleRef.get(WebhookController)).toBeDefined();
  });
});
