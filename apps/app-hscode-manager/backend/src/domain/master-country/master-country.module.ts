import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ImportCountryEntity } from './entity/import-country.entity';
import { ExportCountryEntity } from './entity/export-country.entity';
import { ImportCountryService } from './service/import-country.service';
import { ExportCountryService } from './service/export-country.service';
import { ImportCountryController } from './controller/import-country.controller';
import { ExportCountryController } from './controller/export-country.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportCountryEntity, ExportCountryEntity]),
    AuthModule,
  ],
  providers: [ImportCountryService, ExportCountryService],
  controllers: [ImportCountryController, ExportCountryController],
  exports: [ImportCountryService, ExportCountryService],
})
export class MasterCountryModule {}
