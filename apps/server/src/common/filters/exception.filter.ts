
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const details =
      exception instanceof Error
        ? exception.message
        : typeof exception === 'string'
          ? exception
          : exception
            ? JSON.stringify(exception)
            : '';
    const message = exception instanceof HttpException ? exception.message : `Internal server error in path ${request.url}`;

    response
      .status(status)
      .json({
        status: false,
        message: message,
        ...(status >= 500 ? { details } : {}),
        data: null,
        statusCode: status,
      });
  }
}
