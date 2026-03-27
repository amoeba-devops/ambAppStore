import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SubscriptionEntity, SubscriptionStatus } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/request/create-subscription.dto';
import { AppService } from '../platform-app/app.service';
import { AmaJwtPayload } from '../auth/interfaces/ama-jwt-payload.interface';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
    private readonly appService: AppService,
  ) {}

  async create(dto: CreateSubscriptionDto, user: AmaJwtPayload): Promise<SubscriptionEntity> {
    const app = await this.appService.findBySlug(dto.app_slug);
    if (!app) {
      throw new BusinessException('PLT-E4001', 'App not found', HttpStatus.NOT_FOUND);
    }

    // 중복 신청 방지: 같은 ent_id + app_id로 ACTIVE 또는 PENDING 존재 시 거부
    const existing = await this.subscriptionRepository.findOne({
      where: {
        entId: user.entityId,
        appId: app.appId,
        subStatus: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING]),
      },
    });
    if (existing) {
      const msg = existing.subStatus === SubscriptionStatus.ACTIVE
        ? 'Already subscribed to this app'
        : 'Subscription request already pending';
      throw new BusinessException('PLT-E3001', msg, HttpStatus.CONFLICT);
    }

    const subscription = this.subscriptionRepository.create({
      entId: user.entityId,
      entCode: dto.ent_code,
      entName: dto.ent_name,
      appId: app.appId,
      subStatus: SubscriptionStatus.PENDING,
      subRequestedBy: user.userId,
      subRequestedName: user.name,
      subRequestedEmail: user.email,
      subReason: dto.reason || null,
    });

    const saved = await this.subscriptionRepository.save(subscription);
    saved.app = app;
    return saved;
  }

  async findMySubscriptions(entityId: string): Promise<SubscriptionEntity[]> {
    return this.subscriptionRepository.find({
      where: { entId: entityId },
      relations: ['app'],
      order: { subCreatedAt: 'DESC' },
    });
  }

  async checkStatus(entityId: string, appSlug: string): Promise<SubscriptionEntity | null> {
    const app = await this.appService.findBySlug(appSlug);
    if (!app) return null;

    return this.subscriptionRepository.findOne({
      where: {
        entId: entityId,
        appId: app.appId,
        subStatus: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING, SubscriptionStatus.SUSPENDED]),
      },
      order: { subCreatedAt: 'DESC' },
    });
  }
}
