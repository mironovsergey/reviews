import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { WidgetApiEnv } from './env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Служба закрыта обратным прокси, поэтому адрес клиента берется из
  // X-Forwarded-For: иначе ограничение частоты считало бы все обращения
  // пришедшими с одного адреса. Доверие ограничено одним узлом - ближайшим
  // прокси; заголовок, добавленный клиентом, во внимание не принимается.
  app.set('trust proxy', 1);

  // Виджет встраивается на чужие сайты, поэтому origin отражается любой.
  // Фактический доступ ограничивает ApiKeyGuard проверкой домена.
  app.enableCors({
    origin: true,
    methods: ['GET'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Позволяет закрыть соединение с Mongo при остановке процесса.
  app.enableShutdownHooks();

  const config = app.get<ConfigService<WidgetApiEnv, true>>(ConfigService);

  await app.listen(config.get('WIDGET_API_PORT', { infer: true }));
}

void bootstrap();
