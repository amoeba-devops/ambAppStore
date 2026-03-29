import { Module } from '@nestjs/common';
import { EntityAccessController } from './entity-access.controller';
import { CorporationModule } from '../corporation/corporation.module';

@Module({
  imports: [CorporationModule],
  controllers: [EntityAccessController],
})
export class EntityAccessModule {}
