import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Response } from 'express';
import type { CorrelatedRequest } from '../types/request-context';
import { AutosError } from '../../integrations/autos/autos-error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const req = context.getRequest<CorrelatedRequest>();
    const res = context.getResponse<Response>();
    this.respond(exception, req, res);
  }

  respond(exception: unknown, req: CorrelatedRequest, res: Response): void {
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const error = STATUS_CODES[statusCode] ?? 'Error';
    if (/^\/autos\/v1(?:\/|$)/.test(req.originalUrl.split('?')[0])) {
      res.removeHeader('Cache-Control');
      const payload =
        exception instanceof AutosError
          ? exception.getResponse()
          : {
              type: 'about:blank',
              title: error,
              status: statusCode,
              code:
                statusCode === 429
                  ? 'RATE_LIMIT_EXCEEDED'
                  : statusCode >= 500 ||
                      statusCode === 401 ||
                      statusCode === 403
                    ? 'BOOKING_NOT_CONFIRMED'
                    : 'VALIDATION_FAILED',
              detail: statusCode >= 500 ? 'Internal server error' : error,
            };
      if (!res.headersSent)
        res.status(statusCode).type('application/problem+json').json(payload);
      return;
    }
    let message: string | string[] =
      statusCode >= 500 ? 'Internal server error' : error;
    if (exception instanceof HttpException && statusCode < 500) {
      const response = exception.getResponse();
      if (typeof response === 'string') message = response;
      else if ('message' in response) {
        const detail: unknown = response.message;
        if (
          typeof detail === 'string' ||
          (Array.isArray(detail) &&
            detail.every((item: unknown) => typeof item === 'string'))
        ) {
          message = detail as string | string[];
        }
      }
    }
    if (!res.headersSent)
      res.status(statusCode).json({
        statusCode,
        error,
        message,
        path: req.originalUrl.split('?')[0],
        timestamp: new Date().toISOString(),
        requestId: req.correlationId,
      });
  }
}
