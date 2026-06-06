import pino from 'pino'
import { loadEnv } from '../env.js'

const env = loadEnv()

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'basmat-server' },
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', '*.identifierValue', 'identifierValue'],
    censor: '[redacted]',
  },
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
})

export function lookupLogger(lookupId: string) {
  return logger.child({ lookup_id: lookupId })
}
