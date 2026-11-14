jest.mock('../utils/Otp/otp.service', () => ({
  OtpService: class OtpService {},
}));

import { UserService } from './user.service';

describe('UserService.updateProfile', () => {
  it('updates only the authenticated user profile fields', async () => {
    const updatedUser = {
      id: 'user-1',
      username: 'Updated name',
      email: 'user@example.com',
      phone: '+201000000000',
      role: 'user',
      picture_url: null,
    };
    const updateProfile = jest.fn().mockResolvedValue(updatedUser);
    const service = new UserService(
      { updateProfile } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.updateProfile('user-1', {
        username: 'Updated name',
        phone: '01012345678',
      }),
    ).resolves.toEqual(updatedUser);

    expect(updateProfile).toHaveBeenCalledWith('user-1', {
      username: 'Updated name',
      phone: '+201012345678',
    });
  });
});
