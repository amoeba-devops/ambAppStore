import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown>;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'success' in res) {
        body = res as Record<string, unknown>;
      } else {
        body = {
          success: false,
          data: null,
          error: {
            code: 'CAR-E9999',
            message: typeof res === 'string' ? res : (res as Record<string, unknown>).message || 'Unknown error',
          },
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      console.error('Unhandled exception:', exception);
      body = {
        success: false,
        data: null,
        error: { code: 'CAR-E9999', message: 'Internal server error' },
        timestamp: new Date().toISOString(),
      };
    }

    response.status(status).json(body);
  }
}
