import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Workspace, WorkspaceSchema } from '@reviews/database';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

/** Кабинет клиента: ключ виджета, разрешенные домены и код вставки. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Workspace.name, schema: WorkspaceSchema }]),
    AuthModule,
  ],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
