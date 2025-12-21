import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/role.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check role from trusted proxy header first (set by main backend), then fallback to JWT payload.
    const headerRole = request.headers?.['x-user-role'];
    const normalizedHeaderRole =
      typeof headerRole === 'string'
        ? headerRole
        : Array.isArray(headerRole)
          ? headerRole[0]
          : undefined;

    // Check role from JWT payload (user_metadata.role or role field)
    const userRole = normalizedHeaderRole || user.role || user.user_metadata?.role;

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Access denied: insufficient role');
    }

    return true;
  }
}

