import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DrdJwtPayload } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof DrdJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as DrdJwtPayload;
    return data ? user[data] : user;
  },
);
