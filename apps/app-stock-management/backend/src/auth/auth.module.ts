import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RoleGuard } from './guards/role.guard';
import { EntityScopeGuard } from './guards/entity-scope.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../domain/user/entity/user.entity';
import { Corporation } from '../domain/corporation/entity/corporation.entity';
import { getJwtSecret } from './jwt-secret';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      // 의존성 주입 시점에 읽는다 — ConfigModule 이 .env 를 읽은 뒤 (FIX-261120)
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    TypeOrmModule.forFeature([User, Corporation]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RoleGuard, EntityScopeGuard],
  exports: [JwtModule, JwtAuthGuard, RoleGuard, EntityScopeGuard, AuthService],
})
export class AuthModule {}
