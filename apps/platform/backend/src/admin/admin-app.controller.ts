import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { AdminAppService } from './admin-app.service';
import { AdminMapper } from './admin.mapper';
import { CreateAppDto, UpdateAppDto } from './dto/request/admin-app.request';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { successResponse } from '../common/dto/base-response.dto';

@Controller('admin/apps')
export class AdminAppController {
  constructor(private readonly adminAppService: AdminAppService) {}

  @Get()
  @AdminOnly()
  async findAll() {
    const apps = await this.adminAppService.findAll();
    return successResponse(apps.map(AdminMapper.toAppResponse));
  }

  @Get(':id')
  @AdminOnly()
  async findById(@Param('id') id: string) {
    const app = await this.adminAppService.findById(id);
    return successResponse(AdminMapper.toAppResponse(app));
  }

  @Post()
  @AdminOnly()
  async create(@Body() dto: CreateAppDto) {
    const app = await this.adminAppService.create(dto);
    return successResponse(AdminMapper.toAppResponse(app));
  }

  @Patch(':id')
  @AdminOnly()
  async update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    const app = await this.adminAppService.update(id, dto);
    return successResponse(AdminMapper.toAppResponse(app));
  }

  @Delete(':id')
  @AdminOnly()
  async remove(@Param('id') id: string) {
    await this.adminAppService.softDelete(id);
    return successResponse(null);
  }
}
