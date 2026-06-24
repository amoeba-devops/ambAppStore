import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ExporterEntity } from './entity/exporter.entity';
import { ExporterService } from './service/exporter.service';
import { ExporterController } from './controller/exporter.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExporterEntity]), AuthModule],
  providers: [ExporterService],
  controllers: [ExporterController],
  exports: [ExporterService],
})
export class MasterExporterModule {}
