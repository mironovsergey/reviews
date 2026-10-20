import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ReviewFilterResponseDto } from './dto/review-filter-response.dto';
import { UpdateReviewFilterDto } from './dto/update-review-filter.dto';
import { ReviewFilterService } from './review-filter.service';

@Controller('widget/review-filter')
@UseGuards(JwtAuthGuard)
export class ReviewFilterController {
  constructor(private readonly reviewFilterService: ReviewFilterService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<ReviewFilterResponseDto> {
    return this.reviewFilterService.get(user.workspaceId);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReviewFilterDto,
  ): Promise<ReviewFilterResponseDto> {
    return this.reviewFilterService.update(user.workspaceId, dto);
  }
}
