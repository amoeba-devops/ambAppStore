import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parameter } from './entity/parameter.entity';

@Injectable()
export class ParameterService {
  constructor(
    @InjectRepository(Parameter)
    private readonly repo: Repository<Parameter>,
  ) {}

  async findByEntity(entId: string) {
    let param = await this.repo.findOne({ where: { entId } });
    if (!param) {
      param = this.repo.create({ entId });
      param = await this.repo.save(param);
    }
    return param;
  }

  async update(entId: string, data: Partial<Parameter>) {
    let param = await this.repo.findOne({ where: { entId } });
    if (!param) {
      param = this.repo.create({ entId, ...data });
    } else {
      Object.assign(param, data);
    }
    return this.repo.save(param);
  }
}
