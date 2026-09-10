import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from '@reviews/config';
import { AuthModule } from './auth/auth.module';
import { WidgetApiEnv } from './env';
import { HealthModule } from './health/health.module';
import { ReviewsModule } from './reviews/reviews.module';
import { TargetsModule } from './targets/targets.module';
import { DEFAULT_THROTTLE } from './throttle';

/** Состав API виджета: доступ по ключу кабинета, цели и лента отзывов. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Файл .env лежит в корне рабочего пространства, а процесс стартует
      // из каталога приложения. В контейнере файла нет: значения приходят
      // переменными окружения и проверяются той же функцией.
      envFilePath: ['../../.env'],
      validate: (raw) => validateEnv(WidgetApiEnv, raw),
      cache: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<WidgetApiEnv, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
      }),
    }),
    // Счетчики хранятся в памяти процесса: служба развернута в одном
    // экземпляре, и внешнее хранилище потребовалось бы только при
    // горизонтальном масштабировании.
    ThrottlerModule.forRoot({
      throttlers: [DEFAULT_THROTTLE],
      errorMessage: 'Слишком много запросов, повторите позже',
    }),
    HealthModule,
    AuthModule,
    TargetsModule,
    ReviewsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
