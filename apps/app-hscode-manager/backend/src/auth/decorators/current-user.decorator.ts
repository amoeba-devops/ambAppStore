import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AmaJwtPayload } from '../interfaces/ama-jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof AmaJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AmaJwtPayload;
    return data ? user[data] : user;
  },
);
