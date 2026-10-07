import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export interface AuthUser {
  sub: string;
  role: string;
  brandId?: string | null;
  branchId?: string | null;
}
export const getCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    return user;
  },
);
