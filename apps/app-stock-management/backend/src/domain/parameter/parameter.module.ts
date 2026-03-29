import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parameter } from './entity/parameter.entity';
import { ParameterService } from './parameter.service';
import { ParameterController } from './parameter.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Parameter])],
  controllers: [ParameterController],
  providers: [ParameterService],
  exports: [ParameterService, TypeOrmModule],
})
export class ParameterModule {}
