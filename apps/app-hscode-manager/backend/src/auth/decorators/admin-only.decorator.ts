import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Auth } from './auth.decorator';

export const IS_ADMIN_KEY = 'isAdmin';

/**
 * @AdminOnly() — 참조(Reference)·어드민(설정) 등 관리자 전용 엔드포인트. (POL-005)
 */
export function AdminOnly() {
  return applyDecorators(SetMetadata(IS_ADMIN_KEY, true), Auth());
}
