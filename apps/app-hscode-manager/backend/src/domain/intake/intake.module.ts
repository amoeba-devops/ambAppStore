import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ItemModule } from '../item/item.module';
import { InquiryModule } from '../inquiry/inquiry.module';
import { ExcelImportBatchEntity } from './entity/excel-import-batch.entity';
import { ExcelHoldRowEntity } from './entity/excel-hold-row.entity';
import { ExcelMappingProfileEntity } from './entity/mapping-profile.entity';
import { IntakeService } from './service/intake.service';
import { IntakeController } from './controller/intake.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExcelImportBatchEntity,
      ExcelHoldRowEntity,
      ExcelMappingProfileEntity,
    ]),
    AuthModule,
    ItemModule,
    InquiryModule,
  ],
  providers: [IntakeService],
  controllers: [IntakeController],
})
export class IntakeModule {}
