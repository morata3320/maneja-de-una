import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { PublicUser } from './auth.service';
export interface InternalRequest extends Request {
  user: PublicUser;
}
@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<InternalRequest>();
    if (!req.headers.authorization?.startsWith('Bearer '))
      throw new UnauthorizedException();
    req.user = await this.auth.verify(req.headers.authorization.slice(7));
    return true;
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (
      context.switchToHttp().getRequest<InternalRequest>().user.role !== 'ADMIN'
    )
      throw new ForbiddenException('Requiere ADMIN.');
    return true;
  }
}
