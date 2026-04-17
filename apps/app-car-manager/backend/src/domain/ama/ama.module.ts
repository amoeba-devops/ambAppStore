import { Module } from '@nestjs/common';
import { AmaController } from './controller/ama.controller';
import { AmaService } from './service/ama.service';

@Module({
  controllers: [AmaController],
  providers: [AmaService],
  exports: [AmaService],
})
export class AmaModule {}
