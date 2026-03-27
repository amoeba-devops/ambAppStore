import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { AppService } from './app.service';
import { AppMapper } from './app.mapper';
import { successResponse } from '../common/dto/base-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('platform/apps')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  async findAll() {
    const apps = await this.appService.findAllVisible();
    return successResponse(AppMapper.toCardListResponse(apps));
  }

  @Get(':slug')
  @Public()
  async findBySlug(@Param('slug') slug: string) {
    const app = await this.appService.findBySlug(slug);
    if (!app) {
      throw new NotFoundException({ success: false, data: null, error: { code: 'PLT-E4001', message: 'App not found' }, timestamp: new Date().toISOString() });
    }
    return successResponse(AppMapper.toDetailResponse(app));
  }
}
