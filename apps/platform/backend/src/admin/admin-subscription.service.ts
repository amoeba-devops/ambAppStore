import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { SubscriptionEntity, SubscriptionStatus } from '../platform-subscription/entities/subscription.entity';
import { AppService } from '../platform-app/app.service';
import { AmaJwtPayload } from '../auth/interfaces/ama-jwt-payload.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { AdminSubscriptionListQueryDto } from './dto/request/admin-subscription.request';
import { AdminSubscriptionStatsResponse } from './dto/response/admin-subscription.response';
import { NotificationTriggerService } from '../platform-notification/notification-trigger.service';

/** 허용되는 상태 전이 맵 */
const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatus.PENDING]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.REJECTED],
  [SubscriptionStatus.ACTIVE]: [SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.SUSPENDED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.REJECTED]: [],
  [SubscriptionStatus.CANCELLED]: [],
  [SubscriptionStatus.EXPIRED]: [SubscriptionStatus.ACTIVE],
};

@Injectable()
export class AdminSubscriptionService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
    private readonly appService: AppService,
    private readonly notificationTriggerService: NotificationTriggerService,
  ) {}

  async findAll(query: AdminSubscriptionListQueryDto) {
    const { status, search, app_slug, page = 1, size = 20 } = query;

    const qb = this.subscriptionRepository
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.app', 'app')
      .orderBy('sub.subCreatedAt', 'DESC');

    if (status) {
      qb.andWhere('sub.subStatus = :status', { status });
    }

    if (app_slug) {
      qb.andWhere('app.appSlug = :appSlug', { appSlug: app_slug });
    }

    if (search) {
      qb.andWhere(
        '(sub.entCode LIKE :search OR sub.entName LIKE :search OR sub.subRequestedEmail LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const totalCount = await qb.getCount();
    const items = await qb
      .skip((page - 1) * size)
      .take(size)
      .getMany();

    return {
      items,
      pagination: {
        page,
        size,
        totalCount,
        totalPages: Math.ceil(totalCount / size),
      },
    };
  }

  async findById(subId: string): Promise<SubscriptionEntity> {
    const sub = await this.subscriptionRepository.findOne({
      where: { subId },
      relations: ['app'],
    });
    if (!sub) {
      throw new BusinessException('PLT-E4002', 'Subscription not found', HttpStatus.NOT_FOUND);
    }
    return sub;
  }

  async approve(subId: string, admin: AmaJwtPayload, expiresAt?: string): Promise<SubscriptionEntity> {
    const sub = await this.findById(subId);
    this.validateTransition(sub.subStatus, SubscriptionStatus.ACTIVE);

    sub.subStatus = SubscriptionStatus.ACTIVE;
    sub.subApprovedBy = admin.userId;
    sub.subApprovedAt = new Date();
    sub.subExpiresAt = expiresAt ? new Date(expiresAt) : null;

    const saved = await this.subscriptionRepository.save(sub);
    await this.notificationTriggerService.onSubscriptionApproved(saved);
    return saved;
  }

  async reject(subId: string, rejectReason: string, admin: AmaJwtPayload): Promise<SubscriptionEntity> {
    const sub = await this.findById(subId);
    this.validateTransition(sub.subStatus, SubscriptionStatus.REJECTED);

    sub.subStatus = SubscriptionStatus.REJECTED;
    sub.subRejectReason = rejectReason;
    sub.subApprovedBy = admin.userId;

    const saved = await this.subscriptionRepository.save(sub);
    await this.notificationTriggerService.onSubscriptionRejected(saved);
    return saved;
  }

  async suspend(subId: string, admin: AmaJwtPayload): Promise<SubscriptionEntity> {
    const sub = await this.findById(subId);
    this.validateTransition(sub.subStatus, SubscriptionStatus.SUSPENDED);

    sub.subStatus = SubscriptionStatus.SUSPENDED;

    const saved = await this.subscriptionRepository.save(sub);
    await this.notificationTriggerService.onSubscriptionSuspended(saved);
    return saved;
  }

  async cancel(subId: string, admin: AmaJwtPayload): Promise<SubscriptionEntity> {
    const sub = await this.findById(subId);
    this.validateTransition(sub.subStatus, SubscriptionStatus.CANCELLED);

    sub.subStatus = SubscriptionStatus.CANCELLED;

    return this.subscriptionRepository.save(sub);
  }

  async reactivate(subId: string, admin: AmaJwtPayload, expiresAt?: string): Promise<SubscriptionEntity> {
    const sub = await this.findById(subId);
    this.validateTransition(sub.subStatus, SubscriptionStatus.ACTIVE);

    sub.subStatus = SubscriptionStatus.ACTIVE;
    sub.subApprovedBy = admin.userId;
    sub.subApprovedAt = new Date();
    sub.subExpiresAt = expiresAt ? new Date(expiresAt) : null;

    const saved = await this.subscriptionRepository.save(sub);
    await this.notificationTriggerService.onSubscriptionApproved(saved);
    return saved;
  }

  async getStats(): Promise<AdminSubscriptionStatsResponse> {
    const allSubs = await this.subscriptionRepository.find({ relations: ['app'] });

    const stats: AdminSubscriptionStatsResponse = {
      total: allSubs.length,
      pending: 0,
      active: 0,
      suspended: 0,
      rejected: 0,
      cancelled: 0,
      expired: 0,
      byApp: [],
    };

    const appMap = new Map<string, { appSlug: string; appName: string; active: number; pending: number; total: number }>();

    for (const sub of allSubs) {
      const s = sub.subStatus.toLowerCase() as keyof Pick<AdminSubscriptionStatsResponse, 'pending' | 'active' | 'suspended' | 'rejected' | 'cancelled' | 'expired'>;
      if (s in stats) {
        (stats[s] as number)++;
      }

      const slug = sub.app?.appSlug || 'unknown';
      if (!appMap.has(slug)) {
        appMap.set(slug, { appSlug: slug, appName: sub.app?.appName || '', active: 0, pending: 0, total: 0 });
      }
      const appStat = appMap.get(slug)!;
      appStat.total++;
      if (sub.subStatus === SubscriptionStatus.ACTIVE) appStat.active++;
      if (sub.subStatus === SubscriptionStatus.PENDING) appStat.pending++;
    }

    stats.byApp = Array.from(appMap.values());
    return stats;
  }

  private validateTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BusinessException(
        'PLT-E3002',
        `Cannot transition from ${from} to ${to}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
