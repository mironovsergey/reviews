import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Connection,
  ConnectionSchema,
  Review,
  ReviewSchema,
  ReviewTarget,
  ReviewTargetSchema,
} from '@reviews/database';
import { AggregatorClient, TokenCipher } from '@reviews/aggregator';
import type { SyncWorkerEnv } from '../env';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';

/** Загрузка данных агрегатора в кабинеты: по расписанию и по запросу консоли. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Connection.name, schema: ConnectionSchema },
      { name: ReviewTarget.name, schema: ReviewTargetSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  providers: [
    SyncService,
    SyncScheduler,
    {
      provide: AggregatorClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<SyncWorkerEnv, true>) =>
        new AggregatorClient(config.get('AGGREGATOR_BASE_URL', { infer: true })),
    },
    {
      provide: TokenCipher,
      inject: [ConfigService],
      useFactory: (config: ConfigService<SyncWorkerEnv, true>) =>
        new TokenCipher(config.get('TOKEN_ENCRYPTION_KEY', { infer: true })),
    },
  ],
})
export class SyncModule {}
