import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ItemEntity } from './entity/item.entity';
import { ItemService } from './service/item.service';
import { ItemController } from './controller/item.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ItemEntity]), AuthModule],
  providers: [ItemService],
  controllers: [ItemController],
  exports: [ItemService],
})
export class ItemModule {}
