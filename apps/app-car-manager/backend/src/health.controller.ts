import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: '서버 상태 확인' })
  health() {
    return { status: 'ok', service: 'car-manager-api', timestamp: new Date().toISOString() };
  }
}
