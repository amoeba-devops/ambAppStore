import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalIntegrationEntity } from './entity/external-integration.entity';
import { ExternalIntegrationController } from './external-integration.controller';
import { ExternalIntegrationService } from './external-integration.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExternalIntegrationEntity])],
  controllers: [ExternalIntegrationController],
  providers: [ExternalIntegrationService],
  exports: [ExternalIntegrationService],
})
export class ExternalIntegrationModule {}
