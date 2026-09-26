import { HttpException } from '@nestjs/common';
import type { ProblemDetails } from './contract/autos.types';
export class AutosError extends HttpException {
  constructor(
    status: number,
    code: ProblemDetails['code'],
    detail: string,
    invalidParams?: ProblemDetails['invalidParams'],
  ) {
    super(
      {
        type: 'about:blank',
        title:
          status === 409
            ? 'Conflict'
            : status === 404
              ? 'Not Found'
              : status === 403
                ? 'Forbidden'
                : status === 401
                  ? 'Unauthorized'
                  : status === 429
                    ? 'Too Many Requests'
                    : 'Bad Request',
        status,
        code,
        detail,
        ...(invalidParams ? { invalidParams } : {}),
      } satisfies ProblemDetails,
      status,
    );
  }
}
