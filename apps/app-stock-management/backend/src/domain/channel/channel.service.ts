import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Channel } from './entity/channel.entity';

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private readonly repo: Repository<Channel>,
  ) {}

  async findAll(entId: string) {
    return this.repo.find({ where: { entId, chnDeletedAt: IsNull() } });
  }

  async create(entId: string, data: Partial<Channel>) {
    const entity = this.repo.create({ ...data, entId });
    return this.repo.save(entity);
  }
}
