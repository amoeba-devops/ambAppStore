import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Corporation } from './entity/corporation.entity';
import { CorporationService } from './corporation.service';
import { CorporationController } from './corporation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Corporation])],
  controllers: [CorporationController],
  providers: [CorporationService],
  exports: [CorporationService],
})
export class CorporationModule {}
