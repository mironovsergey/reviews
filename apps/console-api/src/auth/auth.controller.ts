import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SIGN_IN_THROTTLE, SIGN_UP_THROTTLE } from '../throttle';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './auth.types';
import type { AuthResponseDto, CurrentUserResponseDto } from './dto/auth-response.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: SIGN_UP_THROTTLE })
  signUp(@Body() dto: SignUpDto): Promise<AuthResponseDto> {
    return this.authService.signUp(dto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: SIGN_IN_THROTTLE })
  signIn(@Body() dto: SignInDto): Promise<AuthResponseDto> {
    return this.authService.signIn(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserResponseDto> {
    return this.authService.getCurrentUser(user);
  }
}
