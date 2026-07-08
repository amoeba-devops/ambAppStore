import { applyDecorators, UseGuards } from '@nestjs/common';
import { EntityScopeGuard } from '../guards/entity-scope.guard';
import { RoleGuard } from '../guards/role.guard';

/**
 * @Auth() — JWT 인증(전역 가드)에 더해 ent_id 멀티테넌시 격리 + 역할 검사를 적용한다.
 * (JWT 자체는 전역 JwtAuthGuard가 강제하며, @Public()으로만 해제된다.)
 */
export function Auth() {
  return applyDecorators(UseGuards(EntityScopeGuard, RoleGuard));
}
