import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleDriverEntity } from './entity/vehicle-driver.entity';
import { DriverController } from './controller/driver.controller';
import { DriverService } from './service/driver.service';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleDriverEntity])],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
