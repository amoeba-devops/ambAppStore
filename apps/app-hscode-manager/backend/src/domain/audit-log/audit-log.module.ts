import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './entity/audit-log.entity';
import { AuditLogService } from './service/audit-log.service';

/**
 * @Global — AuditLogService를 어디서든 inject 가능하게 함.
 * mutation 액션이 있는 모든 service에서 호출.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
