import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class IsNotAvailableGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isNotAvailable = this.reflector.getAllAndOverride<boolean>(
      "isNotAvailable",
      [context.getHandler(), context.getClass()],
    );

    if (isNotAvailable) {
      throw new ForbiddenException('This service is not available');
    }

    return true;
  }
}
