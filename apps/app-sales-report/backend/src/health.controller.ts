import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      success: true,
      data: { status: 'ok', app: 'sales-report', timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    };
  }
}
