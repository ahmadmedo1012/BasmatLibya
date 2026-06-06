import { z } from 'zod'

export const IdentifierTypeSchema = z.enum(['name', 'username', 'email', 'phone'])
export type IdentifierType = z.infer<typeof IdentifierTypeSchema>

export const IdentifierValueSchema = z
  .string()
  .trim()
  .min(2, { message: 'identifier_too_short' })
  .max(80, { message: 'identifier_too_long' })

export const CreateLookupRequestSchema = z.object({
  identifier: IdentifierValueSchema,
})
export type CreateLookupRequest = z.infer<typeof CreateLookupRequestSchema>
