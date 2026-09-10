import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CONNECT_THROTTLE } from '../throttle';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ConnectAccountDto } from './dto/connect-account.dto';
import type { ConnectionResponseDto } from './dto/connection-response.dto';
import { ConnectionService } from './connection.service';

@Controller('connection')
@UseGuards(JwtAuthGuard)
export class ConnectionController {
  constructor(private readonly connectionService: ConnectionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: CONNECT_THROTTLE })
  connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectAccountDto,
  ): Promise<ConnectionResponseDto> {
    return this.connectionService.connect(user.workspaceId, dto);
  }

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<ConnectionResponseDto> {
    return this.connectionService.getStatus(user.workspaceId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  sync(@CurrentUser() user: AuthenticatedUser): Promise<{ started: boolean }> {
    return this.connectionService.triggerSync(user.workspaceId);
  }
}
