import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  SOURCE_PROVIDERS: z.enum(['mock', 'live']).default('mock'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_MAX_PER_WINDOW: z.coerce.number().int().positive().default(5),
  RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  // --- AI enrichment (NVIDIA NIM, OpenAI-compatible) — feature 001 ---
  ENRICHMENT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  /** Fast path: single streaming call to NVIDIA_MODEL_FAST instead of the 3-stage chain. */
  ENRICHMENT_FAST: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v === 'true' || v === '1' || v === ''),
  NVIDIA_API_KEY: z.string().optional().default(''),
  NVIDIA_BASE_URL: z.string().url().default('https://integrate.api.nvidia.com/v1'),
  NVIDIA_MODEL_RESEARCHER: z.string().default('nvidia/nemotron-3-super-120b-a12b'),
  NVIDIA_MODEL_FAST: z.string().default('nvidia/nemotron-3-super-120b-a12b'),
  NVIDIA_MODEL_ANALYZER: z.string().default('meta/llama-3.3-70b-instruct'),
  NVIDIA_MODEL_REASONER: z.string().default('nvidia/llama-3.3-nemotron-super-49b-v1.5'),
  NVIDIA_MODEL_WRITER: z.string().default('mistralai/mistral-medium-3.5-128b'),
  NVIDIA_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),

  // --- Feature 002: Telegram auth ---
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  // Optional Telegram numeric user id. When unset, no user can be granted owner.
  OWNER_TELEGRAM_ID: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v.trim() === '') return null
      try {
        return BigInt(v)
      } catch {
        return null
      }
    }),

  // --- Feature 002: at-rest encryption of AI model credentials ---
  MODEL_SECRET_KEY: z.string().optional().default(''),
  MODEL_SECRET_KEY_PREVIOUS: z.string().optional().default(''),

  // --- Feature 002: cookie posture ---
  COOKIE_DOMAIN: z.string().optional().default(''),

  // --- PhoneInfoga (phone OSINT — feature 003) ---
  PHONEINFOGA_URL: z.string().optional().default(''),

  // --- External enrichment APIs (feature 003) ---
  // NumVerify (apilayer): real carrier + line type for any country.
  // Free tier: 100 requests/month. Server caches results for 24h to protect quota.
  NUMVERIFY_API_KEY: z.string().optional().default(''),
  // SerpAPI: structured Google search. Used for any identifier type.
  // Free tier: 100 searches/month. Cached for 24h.
  SERPAPI_KEY: z.string().optional().default(''),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | null = null

export function loadEnv(): Env {
  if (cached) return cached
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  - ')
    throw new Error(`Invalid environment configuration:\n  - ${issues}`)
  }
  cached = parsed.data

  // Production-only hardening: surface clearer errors than schema messages.
  if (cached.NODE_ENV === 'production') {
    if (!cached.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is required in production')
    }
    if (!cached.MODEL_SECRET_KEY) {
      throw new Error('MODEL_SECRET_KEY is required in production')
    }
  }

  return cached
}

export const env = new Proxy({} as Env, {
  get(_t, prop: string) {
    const e = loadEnv()
    return (e as Record<string, unknown>)[prop]
  },
})
