import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { VehicleModule } from './domain/vehicle/vehicle.module';
import { DriverModule } from './domain/driver/driver.module';
import { DispatchModule } from './domain/dispatch/dispatch.module';
import { TripLogModule } from './domain/trip-log/trip-log.module';
import { MonitorModule } from './domain/monitor/monitor.module';
import { MaintenanceModule } from './domain/maintenance/maintenance.module';
import { AmaModule } from './domain/ama/ama.module';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.join(__dirname, '..', '.env'),
        '.env',
      ],
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
        database: config.get<string>('DB_DATABASE', 'db_app_car') as string,
        charset: 'utf8mb4',
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    AuthModule,
    VehicleModule,
    DriverModule,
    DispatchModule,
    TripLogModule,
    MaintenanceModule,
    MonitorModule,
    AmaModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
