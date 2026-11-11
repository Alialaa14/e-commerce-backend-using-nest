import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../generated/prisma';
import { StaffController } from './staff.controller';

describe('StaffController role authorization', () => {
  it('limits staff invitation routes to their delegated roles', () => {
    expect(getHandlerMetadata('inviteCustomerService', ROLES_KEY)).toEqual([
      Role.admin,
    ]);
    expect(getHandlerMetadata('inviteBranchManager', ROLES_KEY)).toEqual([
      Role.brandOwner,
    ]);
    expect(getHandlerMetadata('inviteBranchSales', ROLES_KEY)).toEqual([
      Role.BRANCH_MANAGER,
    ]);
    expect(getHandlerMetadata('listBranchStaff', ROLES_KEY)).toEqual([
      Role.brandOwner,
      Role.BRANCH_MANAGER,
    ]);
  });

  it('protects every staff-management route with both guards', () => {
    const methods = [
      'inviteCustomerService',
      'listCustomerServiceAgents',
      'inviteBranchManager',
      'inviteBranchSales',
      'listBranchStaff',
    ];

    for (const method of methods) {
      expect(getHandlerMetadata(method, '__guards__')).toEqual([
        AuthGuard,
        RolesGuard,
      ]);
    }
  });

  it('does not require authentication to accept an invitation', () => {
    expect(
      getHandlerMetadata('acceptInvitation', '__guards__'),
    ).toBeUndefined();
  });
});

function getHandlerMetadata(method: string, key: string) {
  const handler = Object.getOwnPropertyDescriptor(
    StaffController.prototype,
    method,
  )?.value as object | undefined;
  return handler ? (Reflect.getMetadata(key, handler) as unknown) : undefined;
}
