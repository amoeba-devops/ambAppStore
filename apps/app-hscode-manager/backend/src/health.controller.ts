import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';
import { successResponse, BaseResponse } from './common/dto/base-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check(): BaseResponse<{ status: string; service: string }> {
    return successResponse({ status: 'ok', service: 'hscode-manager' });
  }
}
