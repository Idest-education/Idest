import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { userPayload } from '../types/userPayload.interface';
import { Role } from '../enum/role.enum';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user) {
      throw new Error(
        'User not found in request. Make sure AuthGuard is applied.',
      );
    }

    const user: userPayload = {
      id: request.user.sub || request.user.id,
      avatar: request.user.avatar_url || '',
      email: request.user.email || '',
      full_name: request.user.full_name || '',
      role: request.user.role || Role.STUDENT,
    };
    return user;
  },
);
