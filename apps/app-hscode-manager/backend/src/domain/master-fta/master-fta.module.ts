import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { FtaMatrixEntity } from './entity/fta-matrix.entity';
import { FtaMatrixService } from './service/fta-matrix.service';
import { FtaMatrixController } from './controller/fta-matrix.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FtaMatrixEntity]), AuthModule],
  providers: [FtaMatrixService],
  controllers: [FtaMatrixController],
  exports: [FtaMatrixService],
})
export class MasterFtaModule {}
