import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleEntity } from './entity/vehicle.entity';
import { VehicleManagerEntity } from './entity/vehicle-manager.entity';
import { VehicleController } from './controller/vehicle.controller';
import { VehicleService } from './service/vehicle.service';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleEntity, VehicleManagerEntity])],
  controllers: [VehicleController],
  providers: [VehicleService],
  exports: [VehicleService],
})
export class VehicleModule {}
