import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @Public()
  @ApiOperation({ summary: '서버 상태 확인' })
  health() {
    return {
      status: 'ok',
      service: 'hscode-manager-api',
      timestamp: new Date().toISOString(),
    };
  }
}
