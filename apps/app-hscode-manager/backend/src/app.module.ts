import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HealthController } from './health.controller';
import { ReferenceModule } from './domain/reference/reference.module';
import { SearchQaModule } from './domain/search-qa/search-qa.module';
import { ResultModule } from './domain/result/result.module';
import { AttributeModule } from './domain/attribute/attribute.module';
import { ExcelModule } from './domain/excel/excel.module';
import { GtinModule } from './domain/gtin/gtin.module';
import { ReviewModule } from './domain/review/review.module';
import { MappingModule } from './domain/mapping/mapping.module';
import { AdminSettingsModule } from './domain/admin-settings/admin-settings.module';
import { KnowledgeModule } from './domain/knowledge/knowledge.module';
import { MatchingModule } from './domain/matching/matching.module';
import { ChatModule } from './domain/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'hscode_app'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'db_hsm'),
        autoLoadEntities: true,
        // 스테이징/프로덕션은 수동 SQL 마이그레이션 (CLAUDE.md). 로컬도 synchronize 비활성.
        synchronize: false,
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', '127.0.0.1'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    AuthModule,
    ReferenceModule,
    SearchQaModule,
    ResultModule,
    AttributeModule,
    ExcelModule,
    GtinModule,
    ReviewModule,
    MappingModule,
    AdminSettingsModule,
    KnowledgeModule,
    MatchingModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [
    // 전역 JWT 가드 — @Public() 데코레이터로 개별 해제
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
