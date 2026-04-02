import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception';
import { DrdJwtPayload } from '../interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';

@Injectable()
export class EntityScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as DrdJwtPayload;

    if (!user) {
      throw new BusinessException('DRD-E1007', 'Authentication required', HttpStatus.UNAUTHORIZED);
    }

    if (user.role === UserRole.SYSTEM_ADMIN) return true;

    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
