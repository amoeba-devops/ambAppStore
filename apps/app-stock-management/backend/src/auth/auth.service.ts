import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../domain/user/entity/user.entity';
import { Corporation } from '../domain/corporation/entity/corporation.entity';
import { BusinessException } from '../common/exceptions/business.exception';
import { AsmJwtPayload } from './interfaces/jwt-payload.interface';
import { UserStatus, UserRole, CorporationStatus } from '../common/constants/enums';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Corporation)
    private readonly corpRepo: Repository<Corporation>,
    private readonly jwtService: JwtService,
  ) {}

  async login(entityCode: string, email: string, password: string) {
    // Step 1: Validate entity
    const corp = await this.corpRepo.findOne({
      where: { crpCode: entityCode, crpDeletedAt: IsNull() },
    });
    if (!corp) {
      throw new BusinessException('ASM-E1001', 'Invalid entity code', HttpStatus.BAD_REQUEST);
    }
    if (corp.crpStatus !== CorporationStatus.ACTIVE) {
      throw new BusinessException('ASM-E1002', 'Corporation is suspended', HttpStatus.FORBIDDEN);
    }

    // Step 2: Validate user
    const user = await this.userRepo.findOne({
      where: { usrEmail: email, usrDeletedAt: IsNull() },
    });
    if (!user) {
      throw new BusinessException('ASM-E1003', 'Invalid email or password', HttpStatus.BAD_REQUEST);
    }
    if (user.crpId !== corp.crpId) {
      throw new BusinessException('ASM-E1004', 'Invalid email or password', HttpStatus.BAD_REQUEST);
    }
    if (user.usrStatus === UserStatus.LOCKED) {
      throw new BusinessException('ASM-E1005', 'Account is locked', HttpStatus.FORBIDDEN);
    }
    if (user.usrStatus !== UserStatus.ACTIVE) {
      throw new BusinessException('ASM-E1005', 'Account is inactive', HttpStatus.FORBIDDEN);
    }

    // Step 3: Validate password
    const passwordMatch = await bcrypt.compare(password, user.usrPasswordHash);
    if (!passwordMatch) {
      user.usrFailCount = (user.usrFailCount || 0) + 1;
      if (user.usrFailCount >= 5) {
        user.usrStatus = UserStatus.LOCKED;
      }
      await this.userRepo.save(user);
      throw new BusinessException('ASM-E1006', 'Invalid email or password', HttpStatus.BAD_REQUEST);
    }

    // Reset fail count on success
    user.usrFailCount = 0;
    await this.userRepo.save(user);

    // Step 4: Issue JWT
    return this.issueTokens(user, corp, 'DIRECT');
  }

  async amaSsoExchange(amaToken: string) {
    // Decode AMA token (signature verification would require AMA public key)
    let amaPayload: any;
    try {
      amaPayload = this.jwtService.decode(amaToken);
    } catch {
      throw new BusinessException('ASM-E1011', 'Invalid AMA token', HttpStatus.UNAUTHORIZED);
    }
    if (!amaPayload?.entityId || !amaPayload?.email) {
      throw new BusinessException('ASM-E1011', 'Invalid AMA token payload', HttpStatus.UNAUTHORIZED);
    }

    const { sub, entityId, email, role, appCode } = amaPayload;

    // Validate appCode
    if (appCode !== 'app-stock-management') {
      throw new BusinessException('ASM-E1012', 'Invalid app code', HttpStatus.FORBIDDEN);
    }

    // Find or create corporation by AMA entityId
    let corp = await this.corpRepo.findOne({
      where: { crpAmaEntityId: entityId, crpDeletedAt: IsNull() },
    });
    if (!corp) {
      corp = this.corpRepo.create({
        crpCode: `AMA-${entityId.substring(0, 8)}`,
        crpName: 'AMA Entity',
        crpAmaEntityId: entityId,
        crpStatus: CorporationStatus.ACTIVE,
      });
      corp = await this.corpRepo.save(corp);
    }

    // Find or create user
    let user = await this.userRepo.findOne({
      where: { usrEmail: email, crpId: corp.crpId, usrDeletedAt: IsNull() },
    });
    if (!user) {
      const tempHash = await bcrypt.hash('ama-sso-no-password', 12);
      user = this.userRepo.create({
        crpId: corp.crpId,
        usrCode: `AMA-${entityId.substring(0, 8)}`,
        usrEmail: email,
        usrName: email.split('@')[0],
        usrPasswordHash: tempHash,
        usrRole: role === 'MASTER' ? UserRole.ADMIN : UserRole.OPERATOR,
        usrStatus: UserStatus.ACTIVE,
        usrAmaUserId: sub,
        usrTempPassword: false,
      });
      user = await this.userRepo.save(user);
    } else if (!user.usrAmaUserId) {
      // Link existing user to AMA userId
      user.usrAmaUserId = sub;
      await this.userRepo.save(user);
    }

    if (user.usrStatus !== UserStatus.ACTIVE) {
      throw new BusinessException('ASM-E1005', 'Account is inactive', HttpStatus.FORBIDDEN);
    }

    return this.issueTokens(user, corp, 'AMA_SSO');
  }

  /**
   * AMA iframe 쿼리파라미터 기반 자동 인증.
   * Corporation/User가 없으면 자동 생성하여 즉시 대시보드 접근 가능하게 한다.
   */
  async amaEntryLogin(entId: string, entCode: string, entName: string, email: string) {
    // Step 1: Find or create corporation
    let corp = await this.corpRepo.findOne({
      where: { crpAmaEntityId: entId, crpDeletedAt: IsNull() },
    });
    if (!corp) {
      corp = await this.corpRepo.findOne({
        where: { crpCode: entCode, crpDeletedAt: IsNull() },
      });
    }
    if (!corp) {
      corp = this.corpRepo.create({
        crpCode: entCode,
        crpName: entName,
        crpAmaEntityId: entId,
        crpStatus: CorporationStatus.ACTIVE,
      });
      corp = await this.corpRepo.save(corp);
    } else {
      // Update AMA entity mapping if missing
      if (!corp.crpAmaEntityId) {
        corp.crpAmaEntityId = entId;
        await this.corpRepo.save(corp);
      }
    }

    // Step 2: Find or create user
    let user = await this.userRepo.findOne({
      where: { usrEmail: email, crpId: corp.crpId, usrDeletedAt: IsNull() },
    });
    if (!user) {
      const tempHash = await bcrypt.hash('ama-sso-no-password', 12);
      user = this.userRepo.create({
        crpId: corp.crpId,
        usrCode: `AMA-${entCode}`,
        usrEmail: email,
        usrName: email.split('@')[0],
        usrPasswordHash: tempHash,
        usrRole: UserRole.ADMIN,
        usrStatus: UserStatus.ACTIVE,
        usrTempPassword: false,
      });
      user = await this.userRepo.save(user);
    }

    if (user.usrStatus !== UserStatus.ACTIVE) {
      throw new BusinessException('ASM-E1005', 'Account is inactive', HttpStatus.FORBIDDEN);
    }

    return this.issueTokens(user, corp, 'AMA_SSO');
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { usrId: userId } });
    if (!user) {
      throw new BusinessException('ASM-E1003', 'User not found', HttpStatus.BAD_REQUEST);
    }

    const match = await bcrypt.compare(currentPassword, user.usrPasswordHash);
    if (!match) {
      throw new BusinessException('ASM-E1006', 'Current password is incorrect', HttpStatus.BAD_REQUEST);
    }

    user.usrPasswordHash = await bcrypt.hash(newPassword, 12);
    user.usrTempPassword = false;
    await this.userRepo.save(user);

    return { message: 'Password changed successfully' };
  }

  async refreshToken(payload: AsmJwtPayload) {
    const user = await this.userRepo.findOne({ where: { usrId: payload.sub, usrDeletedAt: IsNull() } });
    if (!user || user.usrStatus !== UserStatus.ACTIVE) {
      throw new BusinessException('ASM-E1007', 'Session expired', HttpStatus.UNAUTHORIZED);
    }
    const corp = user.crpId
      ? await this.corpRepo.findOne({ where: { crpId: user.crpId } })
      : null;

    return this.issueTokens(user, corp, payload.source as 'DIRECT' | 'AMA_SSO');
  }

  private issueTokens(user: User, corp: Corporation | null, source: 'DIRECT' | 'AMA_SSO') {
    const payload: AsmJwtPayload = {
      sub: user.usrId,
      ent_id: user.crpId || null,
      crp_code: corp?.crpCode || null,
      role: user.usrRole,
      name: user.usrName,
      temp_password: user.usrTempPassword,
      source,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign({ sub: payload.sub, source }, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.usrId,
        entityId: user.crpId,
        crpCode: corp?.crpCode || null,
        email: user.usrEmail,
        name: user.usrName,
        role: user.usrRole,
        tempPassword: user.usrTempPassword,
      },
    };
  }
}
