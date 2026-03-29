import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CorporationService } from '../corporation/corporation.service';
import { Public } from '../../auth/decorators/public.decorator';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { successResponse } from '../../common/dto/base-response.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';

@ApiTags('auth')
@Controller('entities')
export class EntityAccessController {
  constructor(private readonly corpService: CorporationService) {}

  @Public()
  @Get(':crp_code/validate')
  async validate(@Param('crp_code') crpCode: string) {
    const corp = await this.corpService.findByCode(crpCode);
    if (!corp) throw new BusinessException('ASM-E1001', 'Invalid entity code', HttpStatus.NOT_FOUND);
    return successResponse({
      crpCode: corp.crpCode,
      crpName: corp.crpName,
      crpStatus: corp.crpStatus,
    });
  }

  @Auth()
  @Get('me')
  async me(@CurrentUser() user: AsmJwtPayload) {
    if (!user.ent_id) return successResponse({ crpCode: null, crpName: 'System Admin', role: user.role });
    const corp = await this.corpService.findById(user.ent_id);
    return successResponse({
      crpCode: corp.crpCode,
      crpName: corp.crpName,
      crpStatus: corp.crpStatus,
      role: user.role,
    });
  }
}
