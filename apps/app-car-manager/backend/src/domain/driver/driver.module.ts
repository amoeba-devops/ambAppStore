import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleDriverEntity } from './entity/vehicle-driver.entity';
import { DriverController } from './controller/driver.controller';
import { DriverService } from './service/driver.service';
import { AmaModule } from '../ama/ama.module';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleDriverEntity]), AmaModule],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
