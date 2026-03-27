import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEntity } from './entities/app.entity';
import { AppService } from './app.service';
import { AppController } from './app.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppEntity])],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class PlatformAppModule {}
