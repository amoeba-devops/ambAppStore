import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { MasterCountryModule } from '../master-country/master-country.module';
import { InquiryEntity } from './entity/inquiry.entity';
import { InquiryService } from './service/inquiry.service';
import { InquiryController } from './controller/inquiry.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InquiryEntity]), AuthModule, MasterCountryModule],
  providers: [InquiryService],
  controllers: [InquiryController],
  exports: [InquiryService],
})
export class InquiryModule {}
