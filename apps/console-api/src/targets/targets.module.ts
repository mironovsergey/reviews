import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema, ReviewTarget, ReviewTargetSchema } from '@reviews/database';
import { AuthModule } from '../auth/auth.module';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';

/** Клиники и врачи кабинета; отзывы нужны для подсчета по каждой цели. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReviewTarget.name, schema: ReviewTargetSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    AuthModule,
  ],
  controllers: [TargetsController],
  providers: [TargetsService],
})
export class TargetsModule {}
