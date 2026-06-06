import { z } from 'zod'

export const AiModelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'nvidia',
  'openai_compatible',
])
export type AiModelProvider = z.infer<typeof AiModelProviderSchema>

export const AiModelStatusSchema = z.enum(['active', 'inactive', 'invalid'])
export type AiModelStatus = z.infer<typeof AiModelStatusSchema>

export const AiModelGenerationParamsSchema = z.object({
  systemPrompt: z.string().max(8000),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().int().min(16).max(32000),
  extraParams: z.record(z.unknown()).default({}),
})
export type AiModelGenerationParams = z.infer<typeof AiModelGenerationParamsSchema>

export const AiModelEntryCreateSchema = z.object({
  provider: AiModelProviderSchema,
  modelId: z.string().min(1).max(200),
  displayLabel: z.string().max(120).nullable().optional(),
  credential: z.string().min(1, { message: 'credential_required' }),
  // For openai_compatible (e.g. NVIDIA NIM) — optional baseURL override.
  baseUrl: z.string().url().nullable().optional(),
  generation: AiModelGenerationParamsSchema,
})
export type AiModelEntryCreate = z.infer<typeof AiModelEntryCreateSchema>

export const AiModelEntryUpdateSchema = z
  .object({
    modelId: z.string().min(1).max(200),
    displayLabel: z.string().max(120).nullable().optional(),
    credential: z.string().min(1).optional(),
    baseUrl: z.string().url().nullable().optional(),
    generation: AiModelGenerationParamsSchema,
  })
  .partial()
export type AiModelEntryUpdate = z.infer<typeof AiModelEntryUpdateSchema>

/**
 * Server-side display shape — plaintext credential is NEVER returned (G8).
 */
export const AiModelEntryDisplaySchema = z.object({
  id: z.string().uuid(),
  provider: AiModelProviderSchema,
  modelId: z.string(),
  displayLabel: z.string().nullable(),
  baseUrl: z.string().url().nullable(),
  credential: z.object({
    present: z.boolean(),
    lastFour: z.string(),
  }),
  generation: AiModelGenerationParamsSchema,
  status: AiModelStatusSchema,
  isActive: z.boolean(),
  validatedAt: z.string().nullable(),
  lastValidationError: z.string().nullable(),
  createdAt: z.string(),
  lastUpdatedAt: z.string(),
})
export type AiModelEntryDisplay = z.infer<typeof AiModelEntryDisplaySchema>
