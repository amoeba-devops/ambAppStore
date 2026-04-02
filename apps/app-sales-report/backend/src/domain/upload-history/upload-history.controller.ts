import { Controller, Get, Param, Query } from '@nestjs/common';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UploadHistoryService } from './upload-history.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@Controller('upload-histories')
export class UploadHistoryController {
  constructor(private readonly uploadHistoryService: UploadHistoryService) {}

  @Get()
  @Auth()
  async findAll(
    @CurrentUser() user: DrdJwtPayload,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const s = Math.min(100, Math.max(1, parseInt(size || '20', 10) || 20));
    const result = await this.uploadHistoryService.findAll(user.ent_id, p, s);
    return successListResponse(result.data, result.pagination);
  }

  @Get(':uph_id')
  @Auth()
  async findOne(
    @CurrentUser() user: DrdJwtPayload,
    @Param('uph_id') uphId: string,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const history = await this.uploadHistoryService.findOne(user.ent_id, uphId);
    if (!history) {
      throw new BusinessException('DRD-E3010', 'Upload history not found', HttpStatus.NOT_FOUND);
    }
    return successResponse(history);
  }
}
