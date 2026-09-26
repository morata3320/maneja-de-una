import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { InternalGuard } from './internal.guard';
import type { InternalRequest } from './internal.guard';
@ApiTags('Auth interna')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }
  @Post('login') @HttpCode(200) login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }
  @Get('me') @UseGuards(InternalGuard) @ApiBearerAuth() me(
    @Req() req: InternalRequest,
  ) {
    return req.user;
  }
}
