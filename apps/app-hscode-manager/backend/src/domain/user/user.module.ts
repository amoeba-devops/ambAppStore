import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { MeController } from './controller/me.controller';

@Module({
  imports: [AuthModule],
  controllers: [MeController],
})
export class UserModule {}
