import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class JsonContentTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const hasBody =
      Number(req.headers['content-length'] ?? 0) > 0 ||
      req.headers['transfer-encoding'] !== undefined;
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      hasBody &&
      !req.is(['application/json', 'application/*+json'])
    ) {
      throw new UnsupportedMediaTypeException(
        'Los payloads de escritura deben usar Content-Type application/json.',
      );
    }
    return true;
  }
}
