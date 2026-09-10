import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
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

  @Put('domains')
  updateDomains(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDomainsDto,
  ): Promise<WidgetResponseDto> {
    return this.widgetService.updateDomains(user.workspaceId, dto.domains);
  }
}
