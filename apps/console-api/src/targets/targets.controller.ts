import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ListTargetsQueryDto } from './dto/list-targets-query.dto';
import type { TargetResponseDto } from './dto/target-response.dto';
import { TargetsService } from './targets.service';

@Controller('targets')
@UseGuards(JwtAuthGuard)
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTargetsQueryDto,
  ): Promise<TargetResponseDto[]> {
    return this.targetsService.list(user.workspaceId, query.kind);
  }
}
