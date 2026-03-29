import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { PlatformAppModule } from './platform-app/app.module';
import { PlatformSubscriptionModule } from './platform-subscription/subscription.module';
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './platform-notification/notification.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'db_app_platform',
      charset: 'utf8mb4',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    PlatformAppModule,
    PlatformSubscriptionModule,
    NotificationModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
