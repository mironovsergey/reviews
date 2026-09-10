import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentWorkspace } from '../auth/decorators/current-workspace.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import type { RequestWorkspace } from '../auth/auth.types';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import type { ListReviewsResponseDto } from './dto/review-response.dto';
import { ReviewsService } from './reviews.service';

/**
 * Лента отзывов для виджета.
 *
 * Виджет размещен на сайтах клиентов и обновляется независимо от сервера,
 * поэтому ответ расширяется только совместимо: поле допустимо добавить, но не
 * переименовать и не удалить. Версионирование пути не применяется.
 */
@Controller('reviews')
@UseGuards(ApiKeyGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(
    @CurrentWorkspace() workspace: RequestWorkspace,
    @Query() query: ListReviewsQueryDto,
  ): Promise<ListReviewsResponseDto> {
    return this.reviewsService.list(workspace.id, workspace.reviewFilter, query);
  }
}
