import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import type { RequestWorkspace } from '../auth/auth.types';
import { ListTargetsQueryDto } from './dto/list-targets-query.dto';
import type { TargetResponseDto } from './dto/target-response.dto';
import { TargetsService } from './targets.service';

/**
 * Клиники и врачи для фильтра виджета.
 *
 * Виджет размещен на сайтах клиентов и обновляется независимо от сервера,
 * поэтому ответ расширяется только совместимо: поле допустимо добавить, но не
 * переименовать и не удалить. Версионирование пути не применяется.
 */
@Controller('targets')
@UseGuards(ApiKeyGuard)
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Get()
  list(
    @CurrentWorkspace() workspace: RequestWorkspace,
    @Query() query: ListTargetsQueryDto,
  ): Promise<TargetResponseDto[]> {
    return this.targetsService.list(workspace.id, query);
  }
}
