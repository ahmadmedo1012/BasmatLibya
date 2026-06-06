import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { i18nAr, type ErrorCode, type ErrorResponse } from '@basmat/shared'
import { logger } from '../../observability/logger.js'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly retryAfterSeconds: number | null = null
  ) {
    super(code)
  }
}

export function buildArErrorBody(code: ErrorCode, retryAfterSeconds: number | null = null): ErrorResponse {
  const messageAr =
    (i18nAr.ar.validation as Record<string, string>)[code] ??
    (i18nAr.ar.errors as Record<string, string>)[code] ??
    i18nAr.ar.errors.generic
  return {
    code,
    messageAr,
    retryAfterSeconds: retryAfterSeconds ?? null,
  }
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    if (err.retryAfterSeconds != null) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds))
    }
    return res.status(err.status).json(buildArErrorBody(err.code, err.retryAfterSeconds))
  }
  if (err instanceof ZodError) {
    const first = err.issues[0]
    const code: ErrorCode =
      first?.message === 'identifier_too_short'
        ? 'identifier_too_short'
        : first?.message === 'identifier_too_long'
          ? 'identifier_too_long'
          : 'identifier_invalid'
    return res.status(400).json(buildArErrorBody(code))
  }
  logger.error({ err, reqId: (req as Request & { id?: string }).id }, 'unhandled error')
  return res.status(500).json({
    code: 'identifier_invalid',
    messageAr: i18nAr.ar.errors.generic,
    retryAfterSeconds: null,
  })
}
