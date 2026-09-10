import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewTarget, ReviewTargetSchema } from '@reviews/database';
import { AuthModule } from '../auth/auth.module';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';

/** Клиники и врачи: перечень целей, о которых оставляют отзывы. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: ReviewTarget.name, schema: ReviewTargetSchema }]),
    AuthModule,
  ],
  controllers: [TargetsController],
  providers: [TargetsService],
})
export class TargetsModule {}
