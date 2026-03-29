import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeasonalityIndex } from './entity/seasonality-index.entity';

@Injectable()
export class SeasonalityService {
  constructor(
    @InjectRepository(SeasonalityIndex)
    private readonly repo: Repository<SeasonalityIndex>,
  ) {}

  async findByEntity(entId: string) {
    const indices = await this.repo.find({ where: { entId }, order: { ssiMonth: 'ASC' } });
    if (indices.length === 0) {
      // Initialize 12 months with default 1.0
      const defaults = Array.from({ length: 12 }, (_, i) =>
        this.repo.create({ entId, ssiMonth: i + 1, ssiIndex: 1.0 }),
      );
      return this.repo.save(defaults);
    }
    return indices;
  }

  async update(entId: string, data: { month: number; index: number }[]) {
    for (const item of data) {
      let idx = await this.repo.findOne({ where: { entId, ssiMonth: item.month } });
      if (idx) {
        idx.ssiIndex = item.index;
      } else {
        idx = this.repo.create({ entId, ssiMonth: item.month, ssiIndex: item.index });
      }
      await this.repo.save(idx);
    }
    return this.findByEntity(entId);
  }
}
