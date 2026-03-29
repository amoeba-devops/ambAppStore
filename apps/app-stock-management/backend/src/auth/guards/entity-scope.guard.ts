import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception';
import { AsmJwtPayload } from '../interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class EntityScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AsmJwtPayload;

    if (!user) {
      throw new BusinessException('ASM-E1007', 'Authentication required', HttpStatus.UNAUTHORIZED);
    }

    // SYSTEM_ADMIN bypasses entity scope
    if (user.role === UserRole.SYSTEM_ADMIN) return true;

    // Check if entity info is present
    if (!user.ent_id) {
      throw new BusinessException('ASM-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }

    // Match URL crp_code with JWT crp_code
    const urlCrpCode = request.params?.crp_code;
    if (urlCrpCode && user.crp_code && urlCrpCode !== user.crp_code) {
      throw new BusinessException('ASM-E1010', 'Entity mismatch', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
