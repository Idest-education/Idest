import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { userPayload } from '../types/userPayload.interface';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: userPayload = {
      id: request.user.id,
      avatar: request.user.avatar,
      email: request.user.email,
    };
    return user;
  },
);
