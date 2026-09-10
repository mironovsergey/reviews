import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { RequestWithUser } from '../auth.types';

/** Доступ к консоли: требует действующий токен пользователя. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    request.user = await this.authService.authenticateUser(request.header('authorization'));

    return true;
  }
}
