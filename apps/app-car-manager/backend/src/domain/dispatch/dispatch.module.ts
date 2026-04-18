import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispatchRequestEntity } from './entity/dispatch-request.entity';
import { VehicleEntity } from '../vehicle/entity/vehicle.entity';
import { DispatchController } from './controller/dispatch.controller';
import { DispatchService } from './service/dispatch.service';
import { TripLogModule } from '../trip-log/trip-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([DispatchRequestEntity, VehicleEntity]), TripLogModule],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
