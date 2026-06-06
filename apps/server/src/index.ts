import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import url from 'node:url'
import fs from 'node:fs'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { loadEnv } from './env.js'
import { logger } from './observability/logger.js'
import { requestIdMiddleware } from './http/middleware/request-id.js'
import { visitorTokenMiddleware } from './http/middleware/visitor-token.js'
import { errorMiddleware } from './http/middleware/error.js'
import { healthRouter } from './http/routes/health.js'
import { lookupsRouter } from './http/routes/lookups.js'
import { authRouter } from './http/routes/auth.js'
import { meRouter } from './http/routes/history.js'
import { adminRouter } from './http/routes/admin/index.js'
import { attachSocketServer } from './realtime/socket.js'

const env = loadEnv()
const here = path.dirname(url.fileURLToPath(import.meta.url))

export function buildApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    })
  )
  app.use(
    cors({
      origin: env.PUBLIC_BASE_URL,
      credentials: true,
    })
  )
  app.use(compression())
  app.use(express.json({ limit: '32kb' }))
  app.use(requestIdMiddleware)
  app.use(visitorTokenMiddleware)

  // Edge limiter — broad bucket to defend the process. Fine-grained per-identifier
  // limiting happens inside POST /api/lookups via the DB-backed limiter.
  const edgeLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use('/api/', edgeLimiter)

  app.use('/api', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/me', meRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/lookups', lookupsRouter)

  // In production, serve the SPA from the same Express process.
  // Path is relative to dist/index.js → ../../web/dist
  const webDist = path.resolve(here, '../../web/dist')
  if (env.NODE_ENV === 'production' && fs.existsSync(webDist)) {
    app.use(express.static(webDist))
    const SPA_HTML = fs.readFileSync(path.join(webDist, 'index.html'), 'utf-8')
      .replace(
        '</head>',
        `<script>window.__TG_BOT_USERNAME__=${JSON.stringify(env.TELEGRAM_BOT_USERNAME || '')}</script></head>`
      )
    app.get(/^(?!\/api\/|\/socket\.io\/).*/, (_req, res) => {
      res.type('html').send(SPA_HTML)
    })
  }

  app.use(errorMiddleware)
  return app
}

export function startServer() {
  const app = buildApp()
  const server = createServer(app)
  attachSocketServer(server)

  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram login will return 503 bot_unavailable')
  }
  if (!env.TELEGRAM_BOT_USERNAME) {
    logger.warn('TELEGRAM_BOT_USERNAME not set — Telegram Login Widget will not render')
  }
  if (!env.MODEL_SECRET_KEY) {
    logger.warn('MODEL_SECRET_KEY not set — admin AI model features will fail')
  }

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'basmat server listening')
  })

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — draining connections')
    server.close(() => {
      logger.info('HTTP server closed — exiting')
      process.exit(0)
    })
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit')
      process.exit(1)
    }, 10_000).unref()
  })

  return server
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}
