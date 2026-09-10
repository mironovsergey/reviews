import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema, ReviewTarget, ReviewTargetSchema } from '@reviews/database';
import { AuthModule } from '../auth/auth.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/** Лента отзывов: собственная коллекция и подписи целей из соседней. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: ReviewTarget.name, schema: ReviewTargetSchema },
    ]),
    AuthModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
