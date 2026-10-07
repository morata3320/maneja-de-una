import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
export interface Principal {
  sub: string;
  scopes: string[];
}
export abstract class TokenVerifier {
  abstract verify(token: string): Promise<Principal>;
}
export function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32 || value === 'change_me')
    throw new Error(
      name + ' debe contener un secreto de al menos 32 caracteres.',
    );
  return value;
}
@Injectable()
export class JwtTokenVerifier extends TokenVerifier {
  private readonly key: ReturnType<typeof createRemoteJWKSet> | Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly algorithms: string[];
  constructor() {
    super();
    if (process.env.AUTH_MODE === 'local') {
      this.key = new TextEncoder().encode(
        requiredSecret('AUTOS_LOCAL_JWT_SECRET'),
      );
      this.issuer = process.env.AUTH_ISSUER ?? 'urn:autos:local';
      this.audience = process.env.AUTH_AUDIENCE ?? 'autos-api';
      this.algorithms = ['HS256'];
    } else {
      if (
        !process.env.AUTH_JWKS_URL ||
        !process.env.AUTH_ISSUER ||
        !process.env.AUTH_AUDIENCE
      )
        throw new Error(
          'Configurar AUTH_JWKS_URL, AUTH_ISSUER y AUTH_AUDIENCE.',
        );
      const url = new URL(process.env.AUTH_JWKS_URL);
      if (url.protocol !== 'https:') throw new Error('JWKS requiere HTTPS.');
      this.key = createRemoteJWKSet(url);
      this.issuer = process.env.AUTH_ISSUER;
      this.audience = process.env.AUTH_AUDIENCE;
      this.algorithms = ['RS256', 'ES256'];
    }
  }
  async verify(token: string): Promise<Principal> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: this.algorithms,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      if (!payload.sub) throw new Error();
      const scopes =
        typeof payload.scope === 'string'
          ? payload.scope.split(' ')
          : Array.isArray(payload.scopes)
            ? payload.scopes.filter((s): s is string => typeof s === 'string')
            : [];
      return { sub: payload.sub, scopes };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }
}
