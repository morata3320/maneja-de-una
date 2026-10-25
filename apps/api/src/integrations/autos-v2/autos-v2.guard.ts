import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service';
import { TokenVerifier } from '../../security/token-verifier';

export interface AutosV2Request extends Request {
  actor: { id: string; role: 'USER' | 'ADMIN' | 'INTEGRATION'; scopes: string[] };
}

export const AutosV2Scopes = (...scopes: string[]) =>
  SetMetadata('autos-v2-scopes', scopes);

@Injectable()
export class AutosV2Guard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly internalAuth: AuthService,
    private readonly externalAuth: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AutosV2Request>();
    const required = this.reflector.get<string[]>(
      'autos-v2-scopes',
      context.getHandler(),
    ) ?? ['autos:read'];
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string' && this.validApiKey(apiKey)) {
      req.actor = {
        id: 'booking-api-key',
        role: 'INTEGRATION',
        scopes: ['autos:read', 'autos:book', 'autos:cancel', 'autos:admin', 'autos:maintenance'],
      };
      return this.authorize(req, required);
    }
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
      throw new UnauthorizedException('Bearer token o X-API-Key requerido.');
    const token = auth.slice(7);
    try {
      const user = await this.internalAuth.verify(token);
      req.actor = {
        id: user.id,
        role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
        scopes:
          user.role === 'ADMIN'
            ? ['autos:read', 'autos:book', 'autos:cancel', 'autos:admin', 'autos:maintenance']
            : ['autos:read', 'autos:book', 'autos:cancel'],
      };
    } catch {
      const principal = await this.externalAuth.verify(token);
      req.actor = {
        id: principal.sub,
        role: 'INTEGRATION',
        scopes: principal.scopes,
      };
    }
    return this.authorize(req, required);
  }

  private authorize(req: AutosV2Request, required: string[]): true {
    if (!required.every((scope) => req.actor.scopes.includes(scope)))
      throw new ForbiddenException('Permisos insuficientes.');
    return true;
  }

  private validApiKey(value: string): boolean {
    const expected = process.env.BOOKING_API_KEY;
    if (!expected || expected.length < 32) return false;
    const left = Buffer.from(value);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
