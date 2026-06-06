/**
 * Contract test for LookupResponseSchema (T031, FR-014, FR-015). Pure schema
 * validation for the result-envelope discriminated union. The 'completed'
 * branch is the bulk of the work; 'expired' and 'failed' are the empty
 * states ResultPage renders.
 */
import { describe, it, expect } from 'vitest'
import { LookupResponseSchema } from '@basmat/shared'

const validCompleted = {
  status: 'completed',
  id: '11111111-1111-1111-1111-111111111111',
  identifierValue: 'ahmed@example.com',
  identifierType: 'email',
  summaryHeadlineAr: 'تم العثور على 12 نتيجة ضمن 4 فئات',
  totalFindings: 12,
  categories: [
    {
      key: 'social_presence',
      displayLabelAr: 'الحضور الاجتماعي',
      state: 'completed',
      findings: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          categoryKey: 'social_presence',
          title: 'حساب تويتر',
          snippet: null,
          sourceUrl: 'https://twitter.com/ahmed',
          sourceName: 'Twitter',
          language: 'en',
          confidence: 'high',
          metadata: { followerCount: 1234 },
        },
      ],
    },
    {
      key: 'public_mentions',
      displayLabelAr: 'الإشارات العامة',
      state: 'completed',
      findings: [],
    },
  ],
  enrichment: { status: 'skipped' },
  createdAt: '2026-06-06T12:00:00.000Z',
  expiresAt: '2026-07-06T12:00:00.000Z',
}

describe('LookupResponseSchema (T031)', () => {
  it('parses a completed response with findings and empty enrichment', () => {
    const parsed = LookupResponseSchema.parse(validCompleted)
    if (parsed.status !== 'completed') throw new Error('expected completed')
    expect(parsed.totalFindings).toBe(12)
    expect(parsed.categories).toHaveLength(2)
    expect(parsed.categories[0]?.findings).toHaveLength(1)
    expect(parsed.enrichment.status).toBe('skipped')
  })

  it('parses a completed response with an empty category (state=completed, findings=[])', () => {
    const valid = JSON.parse(JSON.stringify(validCompleted))
    valid.categories[0].state = 'completed'
    valid.categories[0].findings = []
    const parsed = LookupResponseSchema.parse(valid)
    if (parsed.status !== 'completed') throw new Error('expected completed')
    expect(parsed.categories[0]?.findings).toEqual([])
  })

  it('parses an expired response', () => {
    const expired = {
      status: 'expired',
      id: '11111111-1111-1111-1111-111111111111',
      identifierValue: 'ahmed',
      identifierType: 'username',
      expiredAt: '2026-05-01T00:00:00.000Z',
    }
    const parsed = LookupResponseSchema.parse(expired)
    if (parsed.status !== 'expired') throw new Error('expected expired')
    expect(parsed.expiredAt).toBe('2026-05-01T00:00:00.000Z')
  })

  it('parses a failed response with scope="all_categories_failed"', () => {
    const failed = {
      status: 'failed',
      id: '11111111-1111-1111-1111-111111111111',
      scope: 'all_categories_failed',
    }
    const parsed = LookupResponseSchema.parse(failed)
    if (parsed.status !== 'failed') throw new Error('expected failed')
    expect(parsed.scope).toBe('all_categories_failed')
  })

  it('parses a failed response with scope="cancelled"', () => {
    const cancelled = {
      status: 'failed',
      id: '11111111-1111-1111-1111-111111111111',
      scope: 'cancelled',
    }
    const parsed = LookupResponseSchema.parse(cancelled)
    if (parsed.status !== 'failed') throw new Error('expected failed')
    expect(parsed.scope).toBe('cancelled')
  })

  it('rejects an unknown status (the union is closed)', () => {
    expect(() => LookupResponseSchema.parse({ status: 'in_progress', id: 'x' })).toThrow()
  })

  it('rejects a completed response missing categories', () => {
    const bad = { ...validCompleted }
    delete (bad as Partial<typeof bad>).categories
    expect(() => LookupResponseSchema.parse(bad)).toThrow()
  })

  it('rejects a completed response with a non-array enrichment slot', () => {
    const bad = { ...validCompleted, enrichment: 'ready' }
    expect(() => LookupResponseSchema.parse(bad)).toThrow()
  })

  it('rejects a failed response with an unknown scope', () => {
    expect(() =>
      LookupResponseSchema.parse({ status: 'failed', id: 'x', scope: 'partial' })
    ).toThrow()
  })

  it('rejects a completed response with a finding of unknown categoryKey', () => {
    const bad = JSON.parse(JSON.stringify(validCompleted))
    bad.categories[0].findings[0].categoryKey = 'dark_web'
    expect(() => LookupResponseSchema.parse(bad)).toThrow()
  })

  it('rejects a finding with an invalid confidence enum', () => {
    const bad = JSON.parse(JSON.stringify(validCompleted))
    bad.categories[0].findings[0].confidence = 'certain'
    expect(() => LookupResponseSchema.parse(bad)).toThrow()
  })
})
