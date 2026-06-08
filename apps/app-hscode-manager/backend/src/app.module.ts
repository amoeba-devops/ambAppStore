import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import * as path from 'path';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { GlobalExceptionFilter } from './common/filter/global-exception.filter';
import { PlaceholderModule } from './domain/placeholder.module';
import { MasterCountryModule } from './domain/master-country/master-country.module';
import { MasterExporterModule } from './domain/master-exporter/master-exporter.module';
import { MasterDataSourceModule } from './domain/master-data-source/master-data-source.module';
import { MasterFtaModule } from './domain/master-fta/master-fta.module';
import { UserModule } from './domain/user/user.module';
import { InquiryModule } from './domain/inquiry/inquiry.module';
import { ItemModule } from './domain/item/item.module';
import { IntakeModule } from './domain/intake/intake.module';
import { ExternalModule } from './domain/external/external.module';
import { MatchingModule } from './domain/matching/matching.module';
import { ClassificationModule } from './domain/classification/classification.module';
import { AuditLogModule } from './domain/audit-log/audit-log.module';
import { VerificationModule } from './domain/verification/verification.module';
import { ExpertReviewModule } from './domain/expert-review/expert-review.module';
import { AdminModule } from './domain/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.join(__dirname, '..', '.env'), '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: parseInt(config.get<string>('DB_PORT', '3306'), 10),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', '') as string,
        database: config.get<string>('DB_DATABASE', 'db_app_hscode') as string,
        charset: 'utf8mb4',
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    AuthModule,
    PlaceholderModule,
    UserModule,
    MasterCountryModule,
    MasterExporterModule,
    MasterDataSourceModule,
    MasterFtaModule,
    InquiryModule,
    ItemModule,
    IntakeModule,
    ExternalModule,
    MatchingModule,
    ClassificationModule,
    AuditLogModule,
    VerificationModule,
    ExpertReviewModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
})
export class AppModule {}
