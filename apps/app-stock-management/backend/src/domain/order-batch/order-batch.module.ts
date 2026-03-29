import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderBatch } from './entity/order-batch.entity';
import { ReceivingSchedule } from '../receiving-schedule/entity/receiving-schedule.entity';
import { OrderBatchService } from './order-batch.service';
import { OrderBatchController } from './order-batch.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrderBatch, ReceivingSchedule])],
  controllers: [OrderBatchController],
  providers: [OrderBatchService],
  exports: [OrderBatchService, TypeOrmModule],
})
export class OrderBatchModule {}
