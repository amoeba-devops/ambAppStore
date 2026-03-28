import { Controller, Get } from '@nestjs/common';
import { MonitorService } from '../service/monitor.service';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('monitor')
@ApiBearerAuth('access-token')
@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Auth()
  @Get('dashboard')
  async getDashboardSummary(@CurrentUser() user: AmaJwtPayload) {
    const summary = await this.monitorService.getDashboardSummary(user.ent_id);
    return successResponse(summary);
  }

  @Auth()
  @Get('active-dispatches')
  async getActiveDispatches(@CurrentUser() user: AmaJwtPayload) {
    const dispatches = await this.monitorService.getActiveDispatches(user.ent_id);
    return successListResponse(dispatches);
  }
}
