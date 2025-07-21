import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { userPayload } from '../types/userPayload.interface';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user) {
      throw new Error(
        'User not found in request. Make sure AuthGuard is applied.',
      );
    }

    // Handle different JWT payload structures
    const user: userPayload = {
      id: request.user.id || request.user.sub || request.user.userId,
      avatar: request.user.avatar || request.user.picture || '',
      email: request.user.email || request.user.email_address || '',
      role: request.user.role || request.user.user_role || 'user', // Default to 'user' if role is not present
    };
    return user;
  },
);
