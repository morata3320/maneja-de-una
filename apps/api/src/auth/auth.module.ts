import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { InternalGuard, AdminGuard } from './internal.guard';
@Module({
  controllers: [AuthController],
  providers: [AuthService, InternalGuard, AdminGuard],
  exports: [AuthService, InternalGuard, AdminGuard],
})
export class AuthModule {}
