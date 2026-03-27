import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Auth } from './auth.decorator';

export const IS_ADMIN_KEY = 'isAdmin';

export function AdminOnly() {
  return applyDecorators(
    SetMetadata(IS_ADMIN_KEY, true),
    Auth(),
  );
}
