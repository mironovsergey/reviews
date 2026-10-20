import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TargetSnippetQueryDto } from './dto/target-snippet-query.dto';
import type { TargetSnippetResponseDto } from './dto/target-snippet-response.dto';
import type { WidgetResponseDto } from './dto/widget-response.dto';
import { UpdateDomainsDto } from './dto/update-domains.dto';
import { WidgetService } from './widget.service';

@Controller('widget')
@UseGuards(JwtAuthGuard)
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<WidgetResponseDto> {
    return this.widgetService.getSettings(user.workspaceId);
  }

  @Get('snippet')
  getTargetSnippet(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TargetSnippetQueryDto,
  ): Promise<TargetSnippetResponseDto> {
    return this.widgetService.getTargetSnippet(user.workspaceId, query.targetId);
  }

  @Put('domains')
  updateDomains(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDomainsDto,
  ): Promise<WidgetResponseDto> {
    return this.widgetService.updateDomains(user.workspaceId, dto.domains);
  }
}
