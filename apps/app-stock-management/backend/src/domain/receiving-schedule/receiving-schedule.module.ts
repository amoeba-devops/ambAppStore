import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceivingSchedule } from './entity/receiving-schedule.entity';
import { ReceivingScheduleService } from './receiving-schedule.service';
import { ReceivingScheduleController } from './receiving-schedule.controller';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReceivingSchedule]), TransactionModule],
  controllers: [ReceivingScheduleController],
  providers: [ReceivingScheduleService],
  exports: [ReceivingScheduleService, TypeOrmModule],
})
export class ReceivingScheduleModule {}
