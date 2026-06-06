import { loadEnv } from '../../env.js'
import { logger } from '../../observability/logger.js'

const env = loadEnv()

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  model: string
  messages: ChatMessage[]
  temperature?: number
  topP?: number
  maxTokens?: number
  responseJson?: boolean
  signal?: AbortSignal
}

interface NimChoice {
  message?: {
    role: string
    content?: string | null
    reasoning_content?: string | null
    reasoning?: string | null
  }
  delta?: {
    content?: string | null
    reasoning_content?: string | null
    reasoning?: string | null
  }
  finish_reason?: string | null
}

interface NimResponse {
  choices?: NimChoice[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  error?: { message: string }
}

export class NimError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly model?: string
  ) {
    super(message)
  }
}

function authedFetch(opts: ChatCompletionOptions, stream: boolean): Promise<Response> {
  if (!env.NVIDIA_API_KEY) {
    throw new NimError('NVIDIA_API_KEY is not set', undefined, opts.model)
  }
  const url = `${env.NVIDIA_BASE_URL.replace(/\/$/, '')}/chat/completions`
  const ac = new AbortController()
  const timeout = setTimeout(() => ac.abort(), env.NVIDIA_TIMEOUT_MS)
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => ac.abort())
  }
  const body = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    top_p: opts.topP ?? 0.9,
    max_tokens: opts.maxTokens ?? 800,
    stream,
  }
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: stream ? 'text/event-stream' : 'application/json',
      authorization: `Bearer ${env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: ac.signal,
  }).finally(() => clearTimeout(timeout))
}

/**
 * Single OpenAI-compatible chat call against NVIDIA NIM.
 * Returns the assistant's text content (trimmed).
 */
export async function chatComplete(opts: ChatCompletionOptions): Promise<string> {
  let res: Response
  try {
    res = await authedFetch(opts, false)
  } catch (err) {
    throw new NimError(
      `network error calling NIM: ${(err as Error).message}`,
      undefined,
      opts.model
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.warn(
      { model: opts.model, status: res.status, body: text.slice(0, 400) },
      'NIM call failed'
    )
    throw new NimError(`NIM returned ${res.status}`, res.status, opts.model)
  }
  const json = (await res.json()) as NimResponse
  const msg = json.choices?.[0]?.message
  const content = (msg?.content ?? msg?.reasoning_content ?? msg?.reasoning ?? '')?.trim()
  if (!content) {
    throw new NimError('NIM returned empty content', undefined, opts.model)
  }
  return content
}

/**
 * Streaming version — yields content deltas as they arrive over SSE.
 * Reasoning-content deltas are skipped: they're internal "thinking" tokens
 * the user shouldn't see; only emit `content` deltas.
 *
 * Yields after every parsed delta. Caller can stop iterating to abort early.
 */
export async function* chatCompleteStream(
  opts: ChatCompletionOptions
): AsyncGenerator<string, void, void> {
  let res: Response
  try {
    res = await authedFetch(opts, true)
  } catch (err) {
    throw new NimError(
      `network error calling NIM: ${(err as Error).message}`,
      undefined,
      opts.model
    )
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    logger.warn(
      { model: opts.model, status: res.status, body: text.slice(0, 400) },
      'NIM stream failed'
    )
    throw new NimError(`NIM returned ${res.status}`, res.status, opts.model)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE frames are separated by blank lines; each frame is "data: {...}\n".
    let idx: number
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line || !line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const obj = JSON.parse(data) as NimResponse
        const delta = obj.choices?.[0]?.delta
        const piece = delta?.content
        if (typeof piece === 'string' && piece.length > 0) {
          yield piece
        }
      } catch {
        // Ignore malformed frames; SSE proxies sometimes inject heartbeats.
      }
    }
  }
}
