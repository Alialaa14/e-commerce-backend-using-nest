import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export interface AuthUser {
  sub: string;
  role: string;
}
export const getCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    console.log(req);
    const user = req.user;
    return user;
  },
);
