import { StripeService } from './stripe.service';

describe('StripeService.construct', () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  it('verifies events with the configured webhook secret', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const rawBody = Buffer.from('stripe payload');
    const event = { id: 'evt_1' };
    const constructEvent = jest.fn().mockReturnValue(event);
    const service = new StripeService({
      webhooks: { constructEvent },
    } as never);

    expect(service.construct(rawBody, 'stripe-signature')).toBe(event);
    expect(constructEvent).toHaveBeenCalledWith(
      rawBody,
      'stripe-signature',
      'whsec_test',
    );
  });

  it('rejects webhook processing when the signing secret is missing', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const service = new StripeService({
      webhooks: { constructEvent: jest.fn() },
    } as never);

    expect(() =>
      service.construct(Buffer.from('payload'), 'signature'),
    ).toThrow('STRIPE_WEBHOOK_SECRET is not defined');
  });
});
