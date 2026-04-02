import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelMasterEntity } from './entity/channel-master.entity';
import { ChannelMasterController } from './channel-master.controller';
import { ChannelMasterService } from './channel-master.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChannelMasterEntity])],
  controllers: [ChannelMasterController],
  providers: [ChannelMasterService],
  exports: [ChannelMasterService],
})
export class ChannelMasterModule {}
