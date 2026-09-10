import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from '@reviews/config';
import { SyncWorkerEnv } from './env';
import { SyncModule } from './sync/sync.module';

/** Состав обработчика синхронизации: расписание и загрузка данных. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Файл .env лежит в корне рабочего пространства, а процесс стартует
      // из каталога приложения. В контейнере файла нет: значения приходят
      // переменными окружения и проверяются той же функцией.
      envFilePath: ['../../.env'],
      validate: (raw) => validateEnv(SyncWorkerEnv, raw),
      cache: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<SyncWorkerEnv, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
      }),
    }),
    ScheduleModule.forRoot(),
    SyncModule,
  ],
})
export class AppModule {}
