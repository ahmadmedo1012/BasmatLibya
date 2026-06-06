import { SAMPLE_CATEGORIES, SAMPLE_TOTAL_FINDINGS } from './sample-findings.js'
import { SAMPLE_ENRICHMENT } from './sample-enrichment.js'
import type { LookupResponse, LookupSnapshot } from '@basmat/shared'

type Callback = () => void

export class MockLookupService {
  private static lookupId = '00000000-0000-0000-0000-000000000001'
  private static callbacks = new Map<string, Callback[]>()

  static createLookup(): { id: string } {
    return { id: this.lookupId }
  }

  static getLookupSnapshot(id: string): LookupSnapshot {
    return {
      status: 'completed',
      categories: SAMPLE_CATEGORIES.map((c) => ({
        key: c.key,
        state: 'completed',
        findingsSoFar: c.findings,
        failureReason: null,
      })),
      totalFindings: SAMPLE_TOTAL_FINDINGS,
      startedAt: new Date(Date.now() - 30000).toISOString(),
      completedAt: new Date().toISOString(),
    }
  }

  static getLookup(id: string): LookupResponse {
    return {
      status: 'completed',
      id,
      identifierValue: 'محمد علي',
      identifierType: 'name',
      summaryHeadlineAr: SAMPLE_ENRICHMENT.payload?.headlineAr ?? 'ملخص التحليل',
      totalFindings: SAMPLE_TOTAL_FINDINGS,
      categories: SAMPLE_CATEGORIES,
      enrichment: SAMPLE_ENRICHMENT,
      createdAt: new Date(Date.now() - 30000).toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  static getTrial() {
    return { used: 0, limit: 3, remaining: 3, exhausted: false }
  }

  static onProgressUpdate(lookupId: string, cb: Callback) {
    const key = `progress:${lookupId}`
    const existing = this.callbacks.get(key) ?? []
    existing.push(cb)
    this.callbacks.set(key, existing)
    return () => {
      const list = this.callbacks.get(key) ?? []
      this.callbacks.set(key, list.filter((fn) => fn !== cb))
    }
  }

  static onEnrichmentUpdate(lookupId: string, cb: Callback) {
    const key = `enrichment:${lookupId}`
    const existing = this.callbacks.get(key) ?? []
    existing.push(cb)
    this.callbacks.set(key, existing)
    return () => {
      const list = this.callbacks.get(key) ?? []
      this.callbacks.set(key, list.filter((fn) => fn !== cb))
    }
  }

  static simulateProgress(lookupId: string) {
    const snap = this.getLookupSnapshot(lookupId)
    return { ok: true as const, replay: snap }
  }
}
