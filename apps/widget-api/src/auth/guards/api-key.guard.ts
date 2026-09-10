import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { RequestWithWorkspace } from '../auth.types';

/**
 * Доступ виджета: требует публичный ключ кабинета и разрешенный источник.
 *
 * Заголовок X-API-Key переводит запрос в разряд непростых по правилам CORS,
 * поэтому браузер всегда передает Origin. Referer как запасной вариант не
 * используется: он проще подделывается и удаляется политиками приватности.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithWorkspace>();

    request.workspace = await this.authService.authenticateWidget(
      request.header('x-api-key'),
      request.header('origin'),
    );

    return true;
  }
}
