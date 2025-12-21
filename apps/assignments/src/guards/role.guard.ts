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

    // Check role from JWT payload (prioritize user_metadata.role over top-level role)
    // Top-level 'role' is often "authenticated" in Supabase tokens, so we check user_metadata.role first
    let userRole = normalizedHeaderRole;
    if (!userRole) {
      // Prefer user_metadata.role as it contains the actual user role (ADMIN, TEACHER, etc.)
      userRole = user.user_metadata?.role;
    }
    if (!userRole && user.role && user.role !== 'authenticated') {
      // Fallback to top-level role only if it's not the default "authenticated" value
      userRole = user.role;
    }

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Access denied: insufficient role');
    }

    return true;
  }
}

