import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleEntity } from '../vehicle/entity/vehicle.entity';
import { VehicleDriverEntity } from '../driver/entity/vehicle-driver.entity';
import { DispatchRequestEntity } from '../dispatch/entity/dispatch-request.entity';
import { MonitorController } from './controller/monitor.controller';
import { MonitorService } from './service/monitor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleEntity, VehicleDriverEntity, DispatchRequestEntity]),
  ],
  controllers: [MonitorController],
  providers: [MonitorService],
})
export class MonitorModule {}
