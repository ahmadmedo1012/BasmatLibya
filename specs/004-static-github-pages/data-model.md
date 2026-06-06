# Data Model: Static GitHub Pages Deployment

**No schema changes to `packages/shared`.** All existing Zod schemas remain valid — they are used by the client for type-checking and mock data verification.

## Client-Side Data Structures (NEW)

These are NOT persisted — they exist only in browser memory during the session.

### MockLookup

```typescript
interface MockLookup {
  id: string                    // Deterministic hash from identifier (short UUID v4-like)
  identifierValue: string       // The user-entered identifier
  identifierType: IdentifierType
  status: 'in_progress' | 'completed'
  createdAt: string              // ISO timestamp
  snapshot: LookupSnapshot       // Reused from packages/shared schema
  enrichment: EnrichmentSlot     // Reused from packages/shared schema
}
```

**State transitions**: `in_progress` → `completed` (simulated, no failure case for demo)

### MockLookupService

```typescript
class MockLookupService {
  private lookups: Map<string, MockLookup>

  createLookup(identifier: string): MockLookup
    // Generates a deterministic hash ID from the identifier
    // Creates MockLookup with empty categories
    // Starts async simulation that progresses categories in order
    // Returns the lookup immediately (status: in_progress)

  getLookup(id: string): MockLookup | undefined
    // Returns the lookup by ID

  simulateProgress(lookup: MockLookup): void
    // Internal: uses setTimeout to progress through categories:
    //   0ms:   category.started (social_presence)
    //   800ms: category.finding + category.completed (social_presence)
    //   900ms: category.started (public_mentions)
    //   1800ms: category.finding + category.completed (public_mentions)
    //   ...continues through all 5 categories
    //   6500ms: lookup.completed (total ~6.5 seconds)
}
```

### Sample Data (STATIC)

Located in `apps/web/src/data/`:

| File | Content | Source |
|------|---------|--------|
| `sample-findings.ts` | Pre-built `Finding[]` for each category with realistic Arabic/en titles, snippets, source URLs | Extracted from `apps/server/src/analysis/providers/mock/` |
| `sample-enrichment.ts` | A single `EnrichmentPayload` object with Arabic headline, summary, highlights, clusters, risk flags, gaps | Adapted from real enrichment output shape |

**Finding consistency**: The same identifier always produces the same sample data (deterministic by design). The mock does not vary results per identifier — it always returns the same rich dataset.

### Data Flow (Static)

```
User enters identifier
        │
        ▼
HomePage generates MockLookup (hash ID from identifier)
        │
        ▼
Navigates to #/lookups/{id}/progress
        │
        ▼
ProgressPage subscribes to MockLookupService callbacks
  (simulated category events every ~800-1500ms)
        │
        ▼
On lookup.completed → navigates to #/lookups/{id}
        │
        ▼
ResultPage reads MockLookup from service, renders findings
```

## Removed Server-Side Entities

The following server-only entities are eliminated entirely:

| Entity | Reason | Replacement |
|--------|--------|-------------|
| `Lookup` (DB table) | No PostgreSQL | MockLookup (in-memory) |
| `RateLimit` | No Express | None needed |
| `User` / `Session` | No auth | Stub principal = null |
| `AiModel` | No AI calls | Static enrichment payload |
| `AuditLog` | No admin | None |
| `SiteSetting` | No persistence | None |
| `TrialState` | No rate limits | Always available |
