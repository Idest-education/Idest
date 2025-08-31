import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';

@Injectable()
export class SuccessEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
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
      })
    );
  }
}
