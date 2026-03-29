import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SafetyStock } from './entity/safety-stock.entity';

@Injectable()
export class SafetyStockService {
  constructor(
    @InjectRepository(SafetyStock)
    private readonly repo: Repository<SafetyStock>,
  ) {}

  async findAll(entId: string) {
    return this.repo.find({ where: { entId }, order: { sfsCalculatedAt: 'DESC' } });
  }
}
