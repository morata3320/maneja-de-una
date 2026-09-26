import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import type { Request } from 'express';
import { autosDocument } from './contract-document';
import { AutosError } from '../autos-error';
import { TokenVerifier } from '../../../security/token-verifier';
import type { Principal } from '../../../security/token-verifier';
export interface AutosRequest extends Request {
  principal?: Principal;
  affiliate?: string;
}
export const AutosOperation = (path: string, method = 'post') =>
  SetMetadata('autos-operation', { path, method });
const ajv = new Ajv({ strict: false, allErrors: true, coerceTypes: false });
addFormats(ajv);
ajv.addSchema({ components: autosDocument.components }, 'autos');
export const schemaValidator = (schema: object) =>
  ajv.compile({ ...schema, components: autosDocument.components });
@Injectable()
export class AutosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<{ path: string; method: string }>(
      'autos-operation',
      context.getHandler(),
    );
    if (!meta) throw new Error('Operación contractual sin metadata.');
    const operation = autosDocument.paths[meta.path][meta.method];
    const req = context.switchToHttp().getRequest<AutosRequest>();
    const response = context
      .switchToHttp()
      .getResponse<import('express').Response>();
    const scopes = operation.security?.[0]?.OAuth2Security;
    if (scopes) {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer '))
        throw new AutosError(
          401,
          'BOOKING_NOT_CONFIRMED',
          'Bearer token requerido.',
        );
      req.principal = await this.verifier.verify(auth.slice(7));
      if (!scopes.every((s) => req.principal?.scopes.includes(s)))
        throw new AutosError(
          403,
          'BOOKING_NOT_CONFIRMED',
          'Scope insuficiente.',
        );
    }
    for (const parameter of operation.parameters ?? []) {
      let value: unknown =
        parameter.in === 'header'
          ? req.headers[parameter.name.toLowerCase()]
          : req.params[parameter.name];
      if (value === undefined && !parameter.required) continue;
      if (
        parameter.schema.type === 'integer' &&
        typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isInteger(Number(value))
      )
        value = Number(value);
      const validate = schemaValidator(parameter.schema);
      if (!validate(value))
        throw new AutosError(400, 'VALIDATION_FAILED', 'Parámetro inválido.', [
          { name: parameter.name, reason: 'No cumple el contrato.' },
        ]);
      if (parameter.name === 'X-Affiliate-Id') req.affiliate = String(value);
    }
    const body = operation.requestBody;
    if (body) {
      if (req.body === undefined) {
        if (body.required)
          throw new AutosError(400, 'VALIDATION_FAILED', 'Body requerido.');
        req.body = {};
      }
      const validate = schemaValidator(body.content['application/json'].schema);
      if (!validate(req.body))
        throw new AutosError(
          400,
          'VALIDATION_FAILED',
          'Body inválido.',
          validate.errors?.map((e) => ({
            name: e.instancePath || 'body',
            reason: e.message ?? 'Inválido',
          })),
        );
    }
    const cache =
      operation.responses['200']?.headers?.['Cache-Control']?.schema.example;
    if (cache) response.setHeader('Cache-Control', cache);
    if (process.env.API_DEPRECATION_DATE)
      response.setHeader(
        'X-API-Deprecation-Date',
        process.env.API_DEPRECATION_DATE,
      );
    return true;
  }
}
