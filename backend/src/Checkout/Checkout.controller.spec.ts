jest.mock('../User/user.service', () => ({
  UserService: class UserService {},
}));

import { CheckoutService } from './Checkout.service';
import { CheckoutController } from './Checkout.controller';

describe('CheckoutController', () => {
  it('accepts manual coordinates for checkout when no saved address exists', async () => {
    const result = { shipments: [], addressText: 'Cairo' };
    const placeLocation = jest.fn().mockResolvedValue(result);
    const controller = new CheckoutController({
      placeLocation,
    } as unknown as CheckoutService);
    const dto = { latitude: 30.0444, longitude: 31.2357 };

    await expect(
      controller.setAddress('checkout-1', { sub: 'user-1' }, dto),
    ).resolves.toBe(result);

    expect(placeLocation).toHaveBeenCalledWith('checkout-1', 'user-1', dto);
  });
});
