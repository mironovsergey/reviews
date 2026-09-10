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
import { AuthModule } from '../auth/auth.module';
import type { ConsoleApiEnv } from '../env';
import { ConnectionController } from './connection.controller';
import { ConnectionService } from './connection.service';

/**
 * Привязка учетной записи агрегатора отзывов.
 *
 * Коллекции целей и отзывов регистрируются здесь ради счетчиков в консоли;
 * наполняет их отдельный обработчик.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Connection.name, schema: ConnectionSchema },
      { name: ReviewTarget.name, schema: ReviewTargetSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    AuthModule,
  ],
  controllers: [ConnectionController],
  providers: [
    ConnectionService,
    {
      provide: AggregatorClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<ConsoleApiEnv, true>) =>
        new AggregatorClient(config.get('AGGREGATOR_BASE_URL', { infer: true })),
    },
    {
      provide: TokenCipher,
      inject: [ConfigService],
      useFactory: (config: ConfigService<ConsoleApiEnv, true>) =>
        new TokenCipher(config.get('TOKEN_ENCRYPTION_KEY', { infer: true })),
    },
  ],
})
export class ConnectionModule {}
