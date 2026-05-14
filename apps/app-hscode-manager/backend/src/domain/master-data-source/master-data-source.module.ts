import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ExternalDataSourceEntity } from './entity/external-data-source.entity';
import { ExternalDataSourceService } from './service/external-data-source.service';
import { ExternalDataSourceController } from './controller/external-data-source.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExternalDataSourceEntity]), AuthModule],
  providers: [ExternalDataSourceService],
  controllers: [ExternalDataSourceController],
  exports: [ExternalDataSourceService],
})
export class MasterDataSourceModule {}
