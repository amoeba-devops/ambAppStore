import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  public readonly errorCode: string;

  constructor(errorCode: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ success: false, data: null, error: { code: errorCode, message }, timestamp: new Date().toISOString() }, status);
    this.errorCode = errorCode;
  }
}
