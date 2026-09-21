import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';

export interface RequestContext {
  correlationId: string;
}
export interface CorrelatedRequest extends Request {
  correlationId?: string;
}
export const requestContext = new AsyncLocalStorage<RequestContext>();
