import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafetyStock } from './entity/safety-stock.entity';
import { SafetyStockService } from './safety-stock.service';
import { SafetyStockController } from './safety-stock.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SafetyStock])],
  controllers: [SafetyStockController],
  providers: [SafetyStockService],
  exports: [SafetyStockService, TypeOrmModule],
})
export class SafetyStockModule {}
