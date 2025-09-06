import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

@Injectable()
export class SuccessEnvelopeInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}
  intercept(_context: ExecutionContext, next: CallHandler) {
    const skip = this.reflector.get<boolean>('skipEnvelope', _context.getHandler());
    if (skip) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) => {
        const method = _context.switchToHttp().getRequest().method;
        let message = 'Success';
        let statusCode = 200;

        switch (method) {
          case 'GET':
            message = 'Fetched successfully';
            break;
          case 'POST':
            message = 'Created successfully';
            statusCode = 201;
            break;
          case 'PUT':
          case 'PATCH':
            message = 'Updated successfully';
            statusCode = 201;
            break;
          case 'DELETE':
            message = 'Deleted successfully';
            break;
          default:
            message = `${method} successful`;
            break;
        }

        return {
          status: true,
          message,
          data,
          statusCode: statusCode,
        };
      }),
    );
  }
}
