import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Forecast } from './entity/forecast.entity';

@Injectable()
export class ForecastService {
  constructor(
    @InjectRepository(Forecast)
    private readonly repo: Repository<Forecast>,
  ) {}

  async findAll(entId: string) {
    return this.repo.find({ where: { entId }, order: { fctPeriod: 'DESC' } });
  }
}
