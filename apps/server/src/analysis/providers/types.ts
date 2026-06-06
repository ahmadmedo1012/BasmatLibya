import type { CategoryKey, Finding, IdentifierType } from '@basmat/shared'

export interface AnalyzeInput {
  identifierValue: string
  identifierType: IdentifierType
}

export interface AnalyzeCtx {
  signal: AbortSignal
  lookupId: string
}

export interface SourceProvider {
  readonly id: string
  readonly categoryKey: CategoryKey
  readonly displayLabel: string
  supports(idType: IdentifierType): boolean
  analyze(input: AnalyzeInput, ctx: AnalyzeCtx): AsyncIterable<Omit<Finding, 'id'>>
}
