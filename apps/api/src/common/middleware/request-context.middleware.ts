import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { requestContext } from '../types/request-context';
import type { CorrelatedRequest } from '../types/request-context';

const logger = new Logger('HTTP');
export function requestContextMiddleware(
  req: CorrelatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const supplied = req.headers['x-correlation-id'];
  const correlationId =
    typeof supplied === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(supplied)
      ? supplied
      : randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  const start = process.hrtime.bigint();
  res.once('finish', () => {
    logger.log({
      event: 'http_request',
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Number(process.hrtime.bigint() - start) / 1e6,
      correlationId,
    });
  });
  requestContext.run({ correlationId }, next);
}
