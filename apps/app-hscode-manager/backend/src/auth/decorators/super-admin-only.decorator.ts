import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Auth } from './auth.decorator';

export const IS_SUPER_ADMIN_KEY = 'isSuperAdmin';

/**
 * @SuperAdminOnly() — 플랫폼 슈퍼관리자(SUPER_ADMIN) 전용 엔드포인트. (POL-005)
 *
 * 전역 참조 데이터(GPC→HS6, HS6→국가확장)처럼 ent_id로 격리되지 않는 **전 테넌트 공용** 데이터의
 * 쓰기에 적용한다. 테넌트 관리자(MASTER/ADMIN)는 차단 → 크로스테넌트 오염 방지.
 * 읽기는 @AdminOnly()로 테넌트 관리자에게 개방(표준 참조 공유)한다.
 */
export function SuperAdminOnly() {
  return applyDecorators(SetMetadata(IS_SUPER_ADMIN_KEY, true), Auth());
}
