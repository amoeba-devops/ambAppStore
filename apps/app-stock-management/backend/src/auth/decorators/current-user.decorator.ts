import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AsmJwtPayload } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof AsmJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AsmJwtPayload;
    return data ? user[data] : user;
  },
);
