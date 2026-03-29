import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserApplication } from './entity/user-application.entity';
import { CorporationService } from '../corporation/corporation.service';
import { UserService } from '../user/user.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { UapStatus } from '../../common/constants/enums';

@Injectable()
export class UserApplicationService {
  constructor(
    @InjectRepository(UserApplication)
    private readonly repo: Repository<UserApplication>,
    private readonly corpService: CorporationService,
    private readonly userService: UserService,
  ) {}

  async submit(data: Partial<UserApplication>) {
    const uapNo = `UAP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
    const entity = this.repo.create({ ...data, uapNo, uapStatus: UapStatus.PENDING });
    return this.repo.save(entity);
  }

  async findAll() {
    return this.repo.find({ order: { uapCreatedAt: 'DESC' } });
  }

  async findById(id: string) {
    const app = await this.repo.findOne({ where: { uapId: id } });
    if (!app) throw new BusinessException('ASM-E2020', 'Application not found', HttpStatus.NOT_FOUND);
    return app;
  }

  async approve(id: string, reviewerId: string) {
    const app = await this.findById(id);
    if (app.uapStatus !== UapStatus.PENDING) {
      throw new BusinessException('ASM-E2021', 'Application already processed', HttpStatus.BAD_REQUEST);
    }

    // Create corporation
    const crpCode = `CRP-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
    const corp = await this.corpService.create({
      crpCode,
      crpName: app.uapAmaEntityName,
      crpAmaEntityId: app.uapAmaEntityId,
      crpStatus: 'ACTIVE',
    });

    // Create user (ADMIN role with temp password)
    const { user, tempPassword } = await this.userService.createFromApplication(
      corp.crpId,
      app.uapApplicantName,
      app.uapApplicantEmail,
      app.uapApplicantPhone,
      app.uapAmaUserId,
    );

    // Update application
    app.uapStatus = UapStatus.APPROVED;
    app.uapReviewedBy = reviewerId;
    app.uapReviewedAt = new Date();
    app.crpId = corp.crpId;
    app.usrId = user.usrId;
    await this.repo.save(app);

    // TODO: Send email with tempPassword (stub: console.log)
    console.log(`[EMAIL STUB] Temp password for ${app.uapApplicantEmail}: ${tempPassword}`);

    return app;
  }

  async reject(id: string, reviewerId: string, reason: string) {
    const app = await this.findById(id);
    if (app.uapStatus !== UapStatus.PENDING) {
      throw new BusinessException('ASM-E2021', 'Application already processed', HttpStatus.BAD_REQUEST);
    }
    app.uapStatus = UapStatus.REJECTED;
    app.uapReviewedBy = reviewerId;
    app.uapReviewedAt = new Date();
    app.uapRejectReason = reason;
    return this.repo.save(app);
  }
}
