import { Controller, Post, Get, Patch, Param, Body } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionMapper } from './subscription.mapper';
import { CreateSubscriptionDto } from './dto/request/create-subscription.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../auth/interfaces/ama-jwt-payload.interface';
import { successResponse } from '../common/dto/base-response.dto';

@Controller('platform/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @Auth()
  async create(
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user: AmaJwtPayload,
  ) {
    const subscription = await this.subscriptionService.create(dto, user);
    return successResponse(SubscriptionMapper.toResponse(subscription, subscription.app));
  }

  @Get('my')
  @Auth()
  async findMy(@CurrentUser() user: AmaJwtPayload) {
    const subscriptions = await this.subscriptionService.findMySubscriptions(user.entityId);
    return successResponse(SubscriptionMapper.toListResponse(subscriptions));
  }

  @Get('check/:appSlug')
  @Auth()
  async checkStatus(
    @Param('appSlug') appSlug: string,
    @CurrentUser() user: AmaJwtPayload,
  ) {
    const subscription = await this.subscriptionService.checkStatus(user.entityId, appSlug);
    return successResponse(SubscriptionMapper.toStatusResponse(appSlug, subscription ?? undefined));
  }

  @Patch(':subId/cancel')
  @Auth()
  async cancelByUser(
    @Param('subId') subId: string,
    @CurrentUser() user: AmaJwtPayload,
  ) {
    const subscription = await this.subscriptionService.cancelByUser(subId, user);
    return successResponse(SubscriptionMapper.toResponse(subscription, subscription.app));
  }
}
