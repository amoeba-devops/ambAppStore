import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from './entity/user.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { UserStatus } from '../../common/constants/enums';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findAllByEntity(entId: string) {
    return this.repo.find({ where: { crpId: entId, usrDeletedAt: IsNull() }, order: { usrCreatedAt: 'DESC' } });
  }

  async findById(id: string) {
    const user = await this.repo.findOne({ where: { usrId: id, usrDeletedAt: IsNull() } });
    if (!user) throw new BusinessException('ASM-E2010', 'User not found', HttpStatus.NOT_FOUND);
    return user;
  }

  async createFromApplication(crpId: string, name: string, email: string, phone: string | null, amaUserId: string | null): Promise<{ user: User; tempPassword: string }> {
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const userCode = `USR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;

    const user = this.repo.create({
      crpId,
      usrCode: userCode,
      usrEmail: email,
      usrName: name,
      usrPasswordHash: passwordHash,
      usrTempPassword: true,
      usrPhone: phone,
      usrAmaUserId: amaUserId,
      usrRole: 'ADMIN',
      usrStatus: UserStatus.ACTIVE,
    });
    const saved = await this.repo.save(user);
    return { user: saved, tempPassword };
  }

  async changeRole(id: string, role: string) {
    const user = await this.findById(id);
    user.usrRole = role;
    return this.repo.save(user);
  }

  async changeStatus(id: string, status: string) {
    const user = await this.findById(id);
    user.usrStatus = status;
    if (status === UserStatus.ACTIVE) user.usrFailCount = 0;
    return this.repo.save(user);
  }

  async resetPassword(id: string): Promise<string> {
    const user = await this.findById(id);
    const tempPassword = this.generateTempPassword();
    user.usrPasswordHash = await bcrypt.hash(tempPassword, 12);
    user.usrTempPassword = true;
    user.usrFailCount = 0;
    user.usrStatus = UserStatus.ACTIVE;
    await this.repo.save(user);
    return tempPassword;
  }

  async softDelete(id: string) {
    const user = await this.findById(id);
    user.usrDeletedAt = new Date();
    return this.repo.save(user);
  }

  private generateTempPassword(): string {
    return `Temp${Math.random().toString(36).slice(-8)}!`;
  }
}
