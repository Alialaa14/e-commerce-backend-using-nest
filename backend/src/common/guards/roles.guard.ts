import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<any>();
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const userRole = user.role;

    if (!userRole) {
      throw new ForbiddenException('User role missing');
    }

    if (!roles.includes(userRole)) {
      throw new ForbiddenException(
        'You are not authorized to access this route',
      );
    }

    return true;
  }
}
