import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id')
  const id = incoming && incoming.length < 200 ? incoming : randomUUID()
  ;(req as Request & { id: string }).id = id
  res.setHeader('x-request-id', id)
  next()
}
