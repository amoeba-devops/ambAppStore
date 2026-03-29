import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Forecast } from './entity/forecast.entity';
import { ForecastService } from './forecast.service';
import { ForecastController } from './forecast.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Forecast])],
  controllers: [ForecastController],
  providers: [ForecastService],
  exports: [ForecastService, TypeOrmModule],
})
export class ForecastModule {}
