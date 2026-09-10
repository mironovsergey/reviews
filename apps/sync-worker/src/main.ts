import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Обработчик работает без HTTP-сервера: запросов он не принимает, а задания
 * получает по расписанию и через отметки в хранилище.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  // Позволяет закрыть соединение с Mongo и остановить расписание при
  // остановке контейнера.
  app.enableShutdownHooks();
}

void bootstrap();
