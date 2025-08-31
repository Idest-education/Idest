import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { userPayload } from '../types/userPayload.interface';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user) {
      throw new UnauthorizedException(
        'User not found in request. Make sure AuthGuard is applied.',
      );
    }

    const user: userPayload = {
      id: request.user.sub || request.user.id,
      avatar: request.user.avatar_url || '',
      email: request.user.email || '',
      full_name: request.user.full_name || '',
      role: request.user.role,
    };
    return user;
  },
);
