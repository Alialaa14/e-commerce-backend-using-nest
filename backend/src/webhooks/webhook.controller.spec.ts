jest.mock('../User/user.service', () => ({
  UserService: class UserService {},
}));

import { WebhookController } from './webhook.controller';

describe('WebhookController.handleWebhook', () => {
  it('places an order only after Stripe confirms a checkout payment', async () => {
    const rawBody = Buffer.from('stripe payload');
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          metadata: { checkoutId: 'checkout-1', userId: 'user-1' },
        },
      },
    };
    const stripeService = { construct: jest.fn().mockReturnValue(event) };
    const checkoutService = { handleStripeCheckoutEvent: jest.fn() };
    const controller = new WebhookController(
      stripeService as never,
      checkoutService as never,
    );

    await controller.handleWebhook({ rawBody } as never, 'stripe-signature');

    expect(stripeService.construct).toHaveBeenCalledWith(
      rawBody,
      'stripe-signature',
    );
    expect(checkoutService.handleStripeCheckoutEvent).toHaveBeenCalledWith(
      event,
    );
  });

  it('does not place an order before Stripe confirms payment', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'unpaid',
          metadata: { checkoutId: 'checkout-1', userId: 'user-1' },
        },
      },
    };
    const stripeService = { construct: jest.fn().mockReturnValue(event) };
    const checkoutService = { handleStripeCheckoutEvent: jest.fn() };
    const controller = new WebhookController(
      stripeService as never,
      checkoutService as never,
    );

    await controller.handleWebhook(
      { rawBody: Buffer.from('stripe payload') } as never,
      'signature',
    );

    expect(checkoutService.handleStripeCheckoutEvent).toHaveBeenCalledWith(
      event,
    );
  });
});
