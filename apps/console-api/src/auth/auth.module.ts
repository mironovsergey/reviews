import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { ConsoleApiEnv } from '../env';
import { User, UserSchema, Workspace, WorkspaceSchema } from '@reviews/database';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/** Срок действия токена консоли. */
const TOKEN_TTL = '7d';

/**
 * Вход в консоль управления.
 *
 * Наружу выдается гвард: он создается в модуле того контроллера, который
 * его применяет, поэтому вместе с ним экспортируется и AuthService.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<ConsoleApiEnv, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: TOKEN_TTL },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
