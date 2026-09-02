import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isProd = process.env.NODE_ENV === 'production';

    const rawDetail =
      exception instanceof Error
        ? exception.message
        : typeof exception === 'string'
          ? exception
          : exception
            ? JSON.stringify(exception)
            : '';

    if (status >= 500) {
      this.logger.error(
        `${(request as any)?.url ?? ''} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const message = isHttp ? exception.message : 'Internal server error';

    response.status(status).json({
      status: false,
      message,
      ...(status >= 500 && !isProd ? { details: rawDetail } : {}),
      data: null,
      statusCode: status,
    });
  }
}
