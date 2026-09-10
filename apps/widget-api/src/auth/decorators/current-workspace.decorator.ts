import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithWorkspace, RequestWorkspace } from '../auth.types';

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestWorkspace => {
    return context.switchToHttp().getRequest<RequestWithWorkspace>().workspace;
  },
);
