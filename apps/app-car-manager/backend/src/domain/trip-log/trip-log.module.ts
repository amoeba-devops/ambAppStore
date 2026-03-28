import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripLogEntity } from './entity/trip-log.entity';
import { TripLogController } from './controller/trip-log.controller';
import { TripLogService } from './service/trip-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([TripLogEntity])],
  controllers: [TripLogController],
  providers: [TripLogService],
  exports: [TripLogService],
})
export class TripLogModule {}
