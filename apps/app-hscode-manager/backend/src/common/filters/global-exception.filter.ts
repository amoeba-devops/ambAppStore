import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODES } from '../error-codes';

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
            code: ERROR_CODES.UNKNOWN,
            message:
              typeof res === 'string'
                ? res
                : (res as Record<string, unknown>).message || 'Unknown error',
          },
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      body = {
        success: false,
        data: null,
        error: { code: ERROR_CODES.UNKNOWN, message: 'Internal server error' },
        timestamp: new Date().toISOString(),
      };
    }

    response.status(status).json(body);
  }
}
