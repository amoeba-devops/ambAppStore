import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelMasterEntity } from './entity/channel-master.entity';

@Injectable()
export class ChannelMasterService {
  constructor(
    @InjectRepository(ChannelMasterEntity)
    private readonly channelRepo: Repository<ChannelMasterEntity>,
  ) {}

  async findAll(): Promise<ChannelMasterEntity[]> {
    return this.channelRepo.find({ order: { chnCode: 'ASC' } });
  }

  async findByCode(chnCode: string): Promise<ChannelMasterEntity | null> {
    return this.channelRepo.findOne({ where: { chnCode } });
  }
}
