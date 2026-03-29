import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeasonalityIndex } from './entity/seasonality-index.entity';
import { SeasonalityService } from './seasonality.service';
import { SeasonalityController } from './seasonality.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SeasonalityIndex])],
  controllers: [SeasonalityController],
  providers: [SeasonalityService],
  exports: [SeasonalityService, TypeOrmModule],
})
export class SeasonalityModule {}
