import { Controller, Get, Query } from '@nestjs/common';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { CmReportService } from '../service/cm-report.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';

@Controller('cm-report')
export class CmReportController {
  constructor(private readonly cmReportService: CmReportService) {}

  @Get('weekly')
  @Auth()
  async getWeeklySummary(
    @CurrentUser() user: DrdJwtPayload,
    @Query('year') year?: string,
    @Query('week') weekNo?: string,
    @Query('channel') channel?: string,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const data = await this.cmReportService.getWeeklySummary(
      user.ent_id,
      year ? Number(year) : undefined,
      weekNo ? Number(weekNo) : undefined,
      channel,
    );
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('monthly')
  @Auth()
  async getMonthlySummary(
    @CurrentUser() user: DrdJwtPayload,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('channel') channel?: string,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const data = await this.cmReportService.getMonthlySummary(
      user.ent_id,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      channel,
    );
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('daily')
  @Auth()
  async getDailyDetail(
    @CurrentUser() user: DrdJwtPayload,
    @Query('date') date: string,
    @Query('channel') channel?: string,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BusinessException('DRD-E4010', 'Valid date parameter required (YYYY-MM-DD)', HttpStatus.BAD_REQUEST);
    }
    const data = await this.cmReportService.getDailyDetail(
      user.ent_id,
      date,
      channel,
    );
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
