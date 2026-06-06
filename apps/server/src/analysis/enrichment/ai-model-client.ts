/**
 * Unified AI provider client (R-05).
 *
 * One interface; one adapter per provider. Adapters live alongside as
 * separate files so adding a new provider is a single new file.
 */

import { OpenAI } from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AiModelProvider } from '@basmat/shared'

export interface ValidateResult {
  ok: boolean
  reason?: string
}

export interface GenerationOpts {
  systemPrompt: string
  temperature: number
  maxOutputTokens: number
  extraParams?: Record<string, unknown>
  signal?: AbortSignal
}

export interface EnrichmentInput {
  userPrompt: string
  context?: Record<string, unknown>
}

export interface EnrichmentOutput {
  status: 'ready' | 'failed'
  text?: string
  reason?: string
}

export interface AiModelClient {
  readonly provider: AiModelProvider
  validate(opts: { credential: string; modelId: string; baseUrl?: string | null }): Promise<ValidateResult>
  enrich(opts: {
    credential: string
    modelId: string
    baseUrl?: string | null
    input: EnrichmentInput
    generation: GenerationOpts
  }): Promise<EnrichmentOutput>
}

// --- OpenAI / OpenAI-compatible adapter ---
function makeOpenAiAdapter(provider: 'openai' | 'openai_compatible' | 'nvidia'): AiModelClient {
  return {
    provider,
    async validate({ credential, modelId, baseUrl }) {
      try {
        const client = new OpenAI({ apiKey: credential, baseURL: baseUrl ?? undefined })
        await client.models.retrieve(modelId)
        return { ok: true }
      } catch (err) {
        return { ok: false, reason: classifyError(err) }
      }
    },
    async enrich({ credential, modelId, baseUrl, input, generation }) {
      try {
        const client = new OpenAI({ apiKey: credential, baseURL: baseUrl ?? undefined })
        const res = await client.chat.completions.create(
          {
            model: modelId,
            messages: [
              { role: 'system', content: generation.systemPrompt || '' },
              { role: 'user', content: input.userPrompt },
            ],
            temperature: generation.temperature,
            max_tokens: generation.maxOutputTokens,
            ...((generation.extraParams ?? {}) as Record<string, unknown>),
          },
          { signal: generation.signal }
        )
        return { status: 'ready', text: res.choices[0]?.message?.content ?? '' }
      } catch (err) {
        return { status: 'failed', reason: classifyError(err) }
      }
    },
  }
}

// --- Anthropic adapter ---
function makeAnthropicAdapter(): AiModelClient {
  return {
    provider: 'anthropic',
    async validate({ credential, modelId }) {
      try {
        const client = new Anthropic({ apiKey: credential })
        await client.messages.create({
          model: modelId,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        })
        return { ok: true }
      } catch (err) {
        return { ok: false, reason: classifyError(err) }
      }
    },
    async enrich({ credential, modelId, input, generation }) {
      try {
        const client = new Anthropic({ apiKey: credential })
        const res = await client.messages.create(
          {
            model: modelId,
            system: generation.systemPrompt || undefined,
            max_tokens: generation.maxOutputTokens,
            temperature: generation.temperature,
            messages: [{ role: 'user', content: input.userPrompt }],
          },
          { signal: generation.signal }
        )
        const text = res.content
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('')
        return { status: 'ready', text }
      } catch (err) {
        return { status: 'failed', reason: classifyError(err) }
      }
    },
  }
}

// --- Google adapter ---
function makeGoogleAdapter(): AiModelClient {
  return {
    provider: 'google',
    async validate({ credential, modelId }) {
      try {
        const genai = new GoogleGenerativeAI(credential)
        const model = genai.getGenerativeModel({ model: modelId })
        await model.generateContent('ping')
        return { ok: true }
      } catch (err) {
        return { ok: false, reason: classifyError(err) }
      }
    },
    async enrich({ credential, modelId, input, generation }) {
      try {
        const genai = new GoogleGenerativeAI(credential)
        const model = genai.getGenerativeModel({
          model: modelId,
          systemInstruction: generation.systemPrompt || undefined,
          generationConfig: {
            temperature: generation.temperature,
            maxOutputTokens: generation.maxOutputTokens,
          },
        })
        const res = await model.generateContent(input.userPrompt)
        return { status: 'ready', text: res.response.text() }
      } catch (err) {
        return { status: 'failed', reason: classifyError(err) }
      }
    },
  }
}

function classifyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err)
  if (/unauthor|api[_-]?key|401|403/i.test(msg)) return 'auth_failed'
  if (/not[_-]?found|404|model.*not/i.test(msg)) return 'model_not_found'
  if (/timeout|deadline/i.test(msg)) return 'timeout'
  if (/rate.*limit|429/i.test(msg)) return 'rate_limited'
  return 'unknown'
}

const adapters: Record<AiModelProvider, AiModelClient> = {
  openai: makeOpenAiAdapter('openai'),
  anthropic: makeAnthropicAdapter(),
  google: makeGoogleAdapter(),
  nvidia: makeOpenAiAdapter('nvidia'),
  openai_compatible: makeOpenAiAdapter('openai_compatible'),
}

export function pickAdapter(provider: AiModelProvider): AiModelClient {
  return adapters[provider]
}
