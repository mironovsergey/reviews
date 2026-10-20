import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from '@reviews/database';
import { AuthModule } from '../auth/auth.module';
import { ReviewFilterController } from './review-filter.controller';
import { ReviewFilterService } from './review-filter.service';

/** Условия вывода отзывов в виджете; хранятся в записи кабинета. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Workspace.name, schema: WorkspaceSchema }]),
    AuthModule,
  ],
  controllers: [ReviewFilterController],
  providers: [ReviewFilterService],
})
export class ReviewFilterModule {}
