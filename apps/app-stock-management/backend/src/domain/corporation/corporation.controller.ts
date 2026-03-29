import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CorporationService } from './corporation.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('corporations')
@Controller('admin/corporations')
@Auth(UserRole.SYSTEM_ADMIN)
export class CorporationController {
  constructor(private readonly service: CorporationService) {}

  @Get()
  async findAll() {
    const list = await this.service.findAll();
    return successListResponse(list);
  }

  @Post()
  async create(@Body() body: any) {
    const result = await this.service.create(body);
    return successResponse(result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findById(id);
    return successResponse(result);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const result = await this.service.update(id, body);
    return successResponse(result);
  }

  @Patch(':id/status')
  async changeStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const result = await this.service.changeStatus(id, body.status);
    return successResponse(result);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id);
    return successResponse({ message: 'Deleted' });
  }
}
