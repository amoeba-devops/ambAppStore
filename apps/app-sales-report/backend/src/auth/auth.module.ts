import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RoleGuard } from './guards/role.guard';
import { EntityScopeGuard } from './guards/entity-scope.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { getJwtSecret } from './jwt-secret';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      // 의존성 주입 시점에 읽는다 — ConfigModule 이 .env 를 읽은 뒤 (FIX-261120)
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: '4h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RoleGuard, EntityScopeGuard],
  exports: [JwtModule, JwtAuthGuard, RoleGuard, EntityScopeGuard, AuthService],
})
export class AuthModule {}
