import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserApplication } from './entity/user-application.entity';
import { UserApplicationService } from './user-application.service';
import { UserApplicationController } from './user-application.controller';
import { CorporationModule } from '../corporation/corporation.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserApplication]),
    CorporationModule,
    UserModule,
  ],
  controllers: [UserApplicationController],
  providers: [UserApplicationService],
  exports: [UserApplicationService],
})
export class UserApplicationModule {}
