import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationMapper } from './notification.mapper';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../auth/interfaces/ama-jwt-payload.interface';
import { successResponse } from '../common/dto/base-response.dto';

@Controller('platform/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Auth()
  async findMy(
    @CurrentUser() user: AmaJwtPayload,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    const p = parseInt(page || '1', 10);
    const s = parseInt(size || '20', 10);
    const { items, pagination } = await this.notificationService.findByUser(
      user.userId,
      user.entityId,
      p,
      s,
    );
    return successResponse({
      items: NotificationMapper.toListResponse(items),
      pagination,
    });
  }

  @Get('unread-count')
  @Auth()
  async getUnreadCount(@CurrentUser() user: AmaJwtPayload) {
    const count = await this.notificationService.getUnreadCount(user.userId, user.entityId);
    return successResponse({ count });
  }

  @Patch(':ntfId/read')
  @Auth()
  async markAsRead(
    @Param('ntfId') ntfId: string,
    @CurrentUser() user: AmaJwtPayload,
  ) {
    const notification = await this.notificationService.markAsRead(ntfId, user.userId);
    return successResponse(NotificationMapper.toResponse(notification));
  }

  @Patch('read-all')
  @Auth()
  async markAllAsRead(@CurrentUser() user: AmaJwtPayload) {
    await this.notificationService.markAllAsRead(user.userId, user.entityId);
    return successResponse({ success: true });
  }
}
