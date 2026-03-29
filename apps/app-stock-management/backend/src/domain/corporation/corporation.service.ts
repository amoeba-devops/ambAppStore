import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Corporation } from './entity/corporation.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class CorporationService {
  constructor(
    @InjectRepository(Corporation)
    private readonly repo: Repository<Corporation>,
  ) {}

  async findAll() {
    return this.repo.find({ where: { crpDeletedAt: IsNull() }, order: { crpCreatedAt: 'DESC' } });
  }

  async findById(id: string) {
    const corp = await this.repo.findOne({ where: { crpId: id, crpDeletedAt: IsNull() } });
    if (!corp) throw new BusinessException('ASM-E2001', 'Corporation not found', HttpStatus.NOT_FOUND);
    return corp;
  }

  async findByCode(code: string) {
    return this.repo.findOne({ where: { crpCode: code, crpDeletedAt: IsNull() } });
  }

  async create(data: Partial<Corporation>) {
    const existing = data.crpBizNo ? await this.repo.findOne({ where: { crpBizNo: data.crpBizNo, crpDeletedAt: IsNull() } }) : null;
    if (existing) throw new BusinessException('ASM-E2002', 'Duplicate business number', HttpStatus.CONFLICT);
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<Corporation>) {
    const corp = await this.findById(id);
    Object.assign(corp, data);
    return this.repo.save(corp);
  }

  async changeStatus(id: string, status: string) {
    const corp = await this.findById(id);
    corp.crpStatus = status;
    return this.repo.save(corp);
  }

  async softDelete(id: string) {
    const corp = await this.findById(id);
    corp.crpDeletedAt = new Date();
    return this.repo.save(corp);
  }
}
