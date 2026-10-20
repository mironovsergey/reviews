import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ReviewTarget, ReviewTargetSchema, Workspace, WorkspaceSchema } from '@reviews/database';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

/**
 * Кабинет клиента: ключ виджета, разрешенные домены и код вставки.
 *
 * Коллекция целей нужна для кода вставки страницы клиники или врача:
 * цель проверяется на принадлежность кабинету.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: ReviewTarget.name, schema: ReviewTargetSchema },
    ]),
    AuthModule,
  ],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
