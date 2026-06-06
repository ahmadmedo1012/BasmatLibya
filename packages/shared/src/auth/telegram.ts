import { z } from 'zod'

/**
 * Telegram Login Widget payload (R-01).
 * Verified server-side via HMAC-SHA256 over the sorted data-check-string.
 * The `auth_date` freshness window is enforced in the verifier (300 s).
 */
export const TelegramAuthPayloadSchema = z.object({
  id: z.coerce.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.coerce.number().int().positive(),
  hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, { message: 'hash must be lowercase hex SHA-256' }),
})
export type TelegramAuthPayload = z.infer<typeof TelegramAuthPayloadSchema>

/** Maximum age, in seconds, of a Telegram payload we will accept (R-01). */
export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 300
