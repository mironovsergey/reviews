import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { ConsoleApiEnv } from './env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Служба закрыта обратным прокси, поэтому адрес клиента берется из
  // X-Forwarded-For: иначе ограничение частоты считало бы все обращения
  // пришедшими с одного адреса. Доверие ограничено одним узлом - ближайшим
  // прокси; заголовок, добавленный клиентом, во внимание не принимается.
  app.set('trust proxy', 1);

  // Консоль размещается на собственном поддомене и обращается сюда из
  // браузера, поэтому источник запроса отражается.
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

  const config = app.get<ConfigService<ConsoleApiEnv, true>>(ConfigService);

  await app.listen(config.get('CONSOLE_API_PORT', { infer: true }));
}

void bootstrap();
