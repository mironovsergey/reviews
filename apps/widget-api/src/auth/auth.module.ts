import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from '@reviews/database';
import { ApiKeyGuard } from './guards/api-key.guard';
import { AuthService } from './auth.service';

/** Допуск виджета по публичному ключу кабинета. */
@Module({
  imports: [MongooseModule.forFeature([{ name: Workspace.name, schema: WorkspaceSchema }])],
  providers: [AuthService, ApiKeyGuard],
  exports: [AuthService, ApiKeyGuard],
})
export class AuthModule {}
