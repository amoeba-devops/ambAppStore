import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SubscriptionEntity, SubscriptionStatus } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/request/create-subscription.dto';
import { CreatePublicSubscriptionDto } from './dto/request/create-public-subscription.dto';
import { AppEntity } from '../platform-app/entities/app.entity';
import { AppService } from '../platform-app/app.service';
import { AmaJwtPayload } from '../auth/interfaces/ama-jwt-payload.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { EntitySubscriptionResponse, EntityAppSubscription } from './dto/response/entity-subscription.response';

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
      subReason: dto.reason,
    } as Partial<SubscriptionEntity>);

    const saved = await this.subscriptionRepository.save(subscription);
    saved.app = app;
    return saved;
  }

  async createPublic(dto: CreatePublicSubscriptionDto): Promise<SubscriptionEntity> {
    const app = await this.appService.findBySlug(dto.app_slug);
    if (!app) {
      throw new BusinessException('PLT-E4001', 'App not found', HttpStatus.NOT_FOUND);
    }

    const existing = await this.subscriptionRepository.findOne({
      where: {
        entId: dto.ent_id,
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
      entId: dto.ent_id,
      entCode: dto.ent_code,
      entName: dto.ent_name,
      appId: app.appId,
      subStatus: SubscriptionStatus.PENDING,
      subRequestedBy: dto.ent_id,
      subRequestedName: dto.requester_name || dto.ent_name,
      subRequestedEmail: dto.requester_email || '',
      subReason: dto.reason,
    } as Partial<SubscriptionEntity>);

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

  async cancelByUser(subId: string, user: AmaJwtPayload): Promise<SubscriptionEntity> {
    const sub = await this.subscriptionRepository.findOne({
      where: { subId },
      relations: ['app'],
    });
    if (!sub) {
      throw new BusinessException('PLT-E4002', 'Subscription not found', HttpStatus.NOT_FOUND);
    }

    // 본인 확인: ent_id + sub_requested_by 매칭
    if (sub.entId !== user.entityId || sub.subRequestedBy !== user.userId) {
      throw new BusinessException('PLT-E1003', 'Not authorized to cancel this subscription', HttpStatus.FORBIDDEN);
    }

    // PENDING 또는 ACTIVE만 사용자 취소 허용
    if (sub.subStatus !== SubscriptionStatus.PENDING && sub.subStatus !== SubscriptionStatus.ACTIVE) {
      throw new BusinessException(
        'PLT-E3003',
        `Cannot cancel subscription in ${sub.subStatus} status`,
        HttpStatus.BAD_REQUEST,
      );
    }

    sub.subStatus = SubscriptionStatus.CANCELLED;
    return this.subscriptionRepository.save(sub);
  }

  async findByEntity(entId: string): Promise<EntitySubscriptionResponse> {
    // 1. ACTIVE 앱 목록 조회
    const apps = await this.appService.findAllVisible();

    // 2. 해당 entity의 유효 구독 조회
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        entId,
        subStatus: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PENDING,
          SubscriptionStatus.SUSPENDED,
        ]),
      },
      order: { subCreatedAt: 'DESC' },
    });

    // 3. app_id → subscription 매핑 (앱당 최신 1건)
    const subMap = new Map<string, SubscriptionEntity>();
    for (const sub of subscriptions) {
      if (!subMap.has(sub.appId)) {
        subMap.set(sub.appId, sub);
      }
    }

    // 4. 응답 조립
    const result: EntityAppSubscription[] = apps.map((app: AppEntity) => {
      const sub = subMap.get(app.appId);
      return {
        appSlug: app.appSlug,
        appName: app.appName,
        appNameEn: app.appNameEn,
        appStatus: app.appStatus,
        appIconUrl: app.appIconUrl || null,
        subscription: sub
          ? {
              subId: sub.subId,
              status: sub.subStatus,
              requestedAt: sub.subCreatedAt.toISOString(),
              approvedAt: sub.subApprovedAt?.toISOString() || null,
              expiresAt: sub.subExpiresAt?.toISOString() || null,
            }
          : null,
      };
    });

    return { entId, apps: result };
  }
}
