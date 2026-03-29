import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { AdminSubscriptionService } from './admin-subscription.service';
import { AdminMapper } from './admin.mapper';
import { AdminSubscriptionListQueryDto, AdminRejectDto, AdminApproveDto } from './dto/request/admin-subscription.request';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../auth/interfaces/ama-jwt-payload.interface';
import { successResponse } from '../common/dto/base-response.dto';

@Controller('admin/subscriptions')
export class AdminSubscriptionController {
  constructor(private readonly adminSubscriptionService: AdminSubscriptionService) {}

  @Get()
  @AdminOnly()
  async findAll(@Query() query: AdminSubscriptionListQueryDto) {
    const { items, pagination } = await this.adminSubscriptionService.findAll(query);
    return {
      success: true,
      data: {
        items: items.map(AdminMapper.toSubscriptionResponse),
        pagination,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  @AdminOnly()
  async getStats() {
    const stats = await this.adminSubscriptionService.getStats();
    return successResponse(stats);
  }

  @Get(':id')
  @AdminOnly()
  async findById(@Param('id') id: string) {
    const sub = await this.adminSubscriptionService.findById(id);
    return successResponse(AdminMapper.toSubscriptionResponse(sub));
  }

  @Patch(':id/approve')
  @AdminOnly()
  async approve(
    @Param('id') id: string,
    @Body() dto: AdminApproveDto,
    @CurrentUser() admin: AmaJwtPayload,
  ) {
    const sub = await this.adminSubscriptionService.approve(id, admin, dto.expires_at);
    return successResponse(AdminMapper.toSubscriptionResponse(sub));
  }

  @Patch(':id/reject')
  @AdminOnly()
  async reject(
    @Param('id') id: string,
    @Body() dto: AdminRejectDto,
    @CurrentUser() admin: AmaJwtPayload,
  ) {
    const sub = await this.adminSubscriptionService.reject(id, dto.reject_reason, admin);
    return successResponse(AdminMapper.toSubscriptionResponse(sub));
  }

  @Patch(':id/suspend')
  @AdminOnly()
  async suspend(@Param('id') id: string, @CurrentUser() admin: AmaJwtPayload) {
    const sub = await this.adminSubscriptionService.suspend(id, admin);
    return successResponse(AdminMapper.toSubscriptionResponse(sub));
  }

  @Patch(':id/cancel')
  @AdminOnly()
  async cancel(@Param('id') id: string, @CurrentUser() admin: AmaJwtPayload) {
    const sub = await this.adminSubscriptionService.cancel(id, admin);
    return successResponse(AdminMapper.toSubscriptionResponse(sub));
  }

  @Patch(':id/reactivate')
  @AdminOnly()
  async reactivate(
    @Param('id') id: string,
    @Body() dto: AdminApproveDto,
    @CurrentUser() admin: AmaJwtPayload,
  ) {
    const sub = await this.adminSubscriptionService.reactivate(id, admin, dto.expires_at);
    return successResponse(AdminMapper.toSubscriptionResponse(sub));
  }
}
