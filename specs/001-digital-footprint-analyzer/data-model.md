# Phase 1 Data Model — Digital Footprint Analyzer (BasmatLibya)

**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Date**: 2026-06-03

PostgreSQL schema, expressed conceptually here and mirrored 1:1 in `apps/server/src/db/schema.ts` via Drizzle. All tables use `id` as a primary key of type `uuid` (server-generated with `gen_random_uuid()`) unless stated otherwise. Timestamps are `timestamptz NOT NULL DEFAULT now()`.

---

## Tables

### `source_categories` (seed table, ~5 rows)

Logical groupings that the result page renders as sections. Seeded by migration; not user-mutable at runtime.

| Column            | Type                | Notes |
|-------------------|---------------------|-------|
| `key`             | `text PRIMARY KEY`  | Stable machine key. Enum-like: `social_presence`, `public_mentions`, `contact_signals`, `reputation_indicators`, `profile_imagery`. |
| `display_label_ar`| `text NOT NULL`     | Arabic chrome label. Imported at build time from `packages/shared/i18n/ar.json`; the migration writes the current values. |
| `ordering_weight` | `integer NOT NULL`  | Lower renders first on the result page. |
| `is_enabled`      | `boolean NOT NULL DEFAULT true` | Lets ops disable a category without a deploy. |

Indexes: PK on `key`. `ordering_weight` is small enough not to need an index.

---

### `lookups`

One row per lookup request. The anonymous shareable record.

| Column                | Type                  | Notes |
|-----------------------|-----------------------|-------|
| `id`                  | `uuid PK`             | Used as the share-link slug — must be unguessable. |
| `identifier_value`    | `text NOT NULL`       | Submitted identifier as typed (after trim). Bounded 2–80 chars by app validation. |
| `identifier_value_normalised` | `text NOT NULL` | Lowercased, NFC-normalised; used by the limiter and dedup key. |
| `identifier_type`     | `text NOT NULL CHECK (identifier_type IN ('name','username','email','phone'))` | Detected type. |
| `status`              | `text NOT NULL CHECK (status IN ('in_progress','completed','cancelled','failed'))` | State machine — see below. |
| `visitor_token_hash`  | `text NOT NULL`       | `sha256(visitor_token)` from the visitor cookie. Used by limiter and abuse review only. |
| `created_at`          | `timestamptz NOT NULL DEFAULT now()` | Submission time. |
| `completed_at`        | `timestamptz NULL`    | Set when status transitions to `completed` or `failed`. |
| `cancelled_at`        | `timestamptz NULL`    | Set when status transitions to `cancelled`. |
| `expires_at`          | `timestamptz NOT NULL` | `created_at + interval '30 days'`. Drives FR-016 expired state. |
| `failure_reason`      | `text NULL`           | Free-form internal reason when status=`failed`. Never shown to users. |

Indexes:
- PK on `id`.
- `(visitor_token_hash, created_at DESC)` for limiter scans.
- `(identifier_value_normalised, created_at DESC)` for dedup-coalescing within a short window.
- `(status, expires_at)` for the daily purge sweep.

State transitions (enforced in the service layer, not in the DB):

```
in_progress ──┬──► completed   (all categories settled)
              ├──► failed      (every category failed or pipeline error)
              └──► cancelled   (user clicks cancel)
```

Cancel is allowed only from `in_progress`. Once `completed`/`failed`/`cancelled`, a lookup is immutable.

---

### `lookup_categories`

One row per `(lookup, source_category)` pair. Tracks per-category state for live progress.

| Column            | Type             | Notes |
|-------------------|------------------|-------|
| `id`              | `uuid PK`        |  |
| `lookup_id`       | `uuid NOT NULL REFERENCES lookups(id) ON DELETE CASCADE` |  |
| `category_key`    | `text NOT NULL REFERENCES source_categories(key)` |  |
| `state`           | `text NOT NULL CHECK (state IN ('queued','running','completed','failed','skipped'))` | `skipped` when no provider supports the lookup's identifier type for this category. |
| `started_at`      | `timestamptz NULL` | Set when transitioning to `running`. |
| `settled_at`      | `timestamptz NULL` | Set when transitioning to `completed`/`failed`/`skipped`. |
| `failure_reason`  | `text NULL`        | Provider error class (e.g. `timeout`, `provider_unavailable`). Surfaced as a designed degraded-state, not raw text. |

Indexes:
- PK on `id`.
- `UNIQUE (lookup_id, category_key)` — one row per pair.
- `(lookup_id, state)` for progress queries.

---

### `findings`

One row per piece of evidence within a category for a lookup. Persisted as the provider streams them in.

| Column           | Type             | Notes |
|------------------|------------------|-------|
| `id`             | `uuid PK`        |  |
| `lookup_id`      | `uuid NOT NULL REFERENCES lookups(id) ON DELETE CASCADE` |  |
| `category_key`   | `text NOT NULL REFERENCES source_categories(key)` |  |
| `title`          | `text NOT NULL`  | Source-native title. May be Arabic, Latin, or mixed. |
| `snippet`        | `text NULL`      | Short source-native excerpt. |
| `source_url`     | `text NOT NULL`  | Public URL the finding points at. |
| `source_name`    | `text NOT NULL`  | Human-readable provider name shown next to the finding. |
| `language`       | `text NULL`      | BCP-47 tag (`ar`, `en`, `fr`, …) so the UI can apply correct font and bidi isolation. |
| `confidence`     | `text NOT NULL CHECK (confidence IN ('high','medium','low'))` | FR-010 confidence indicator. |
| `ordering_weight`| `integer NOT NULL DEFAULT 0` | Lower renders first within its category. |
| `created_at`     | `timestamptz NOT NULL DEFAULT now()` |  |

Indexes:
- PK on `id`.
- `(lookup_id, category_key, ordering_weight)` for the result page render.
- `(lookup_id)` for cascading deletes during retention purge.

---

### `aggregated_results`

One row per completed lookup. The polished unified view's persistent shape, including the reserved AI enrichment slot.

| Column              | Type             | Notes |
|---------------------|------------------|-------|
| `lookup_id`         | `uuid PK REFERENCES lookups(id) ON DELETE CASCADE` | 1:1 with the parent lookup. |
| `summary_headline_ar` | `text NOT NULL` | Generated from the populated categories at completion time (e.g. "تم العثور على 14 إشارة عبر 3 فئات"). Arabic, server-rendered. |
| `total_findings`    | `integer NOT NULL` |  |
| `populated_categories` | `text[] NOT NULL` | `category_key`s that yielded ≥1 finding, in render order. |
| `enrichment_status` | `text NOT NULL CHECK (enrichment_status IN ('skipped','pending','ready','failed')) DEFAULT 'skipped'` | v1 always writes `'skipped'`. Slot reserved for AI iteration. |
| `enrichment_payload`| `jsonb NULL`     | v1 always `NULL`. Future AI provider writes here. |
| `created_at`        | `timestamptz NOT NULL DEFAULT now()` |  |

Indexes:
- PK on `lookup_id`.

---

### `rate_limit_counters`

Sliding-window counters for the application-layer limiter (R-07).

| Column                | Type             | Notes |
|-----------------------|------------------|-------|
| `visitor_token_hash`  | `text NOT NULL`  | `sha256(visitor_token)` from the cookie. |
| `identifier_hash`     | `text NOT NULL`  | `sha256(identifier_value_normalised)`. |
| `window_start`        | `timestamptz NOT NULL` | Truncated to the limiter window (e.g. floor to 10-min). |
| `count`               | `integer NOT NULL DEFAULT 1` |  |
| `expires_at`          | `timestamptz NOT NULL` | `window_start + window_size + grace`. |

Primary key: `(visitor_token_hash, identifier_hash, window_start)`.

Indexes:
- PK as above.
- `(expires_at)` for the periodic purge of expired windows.

---

## Relationships

```
source_categories (key)  ◄── lookup_categories (category_key)
                                        ▲
                                        │
lookups (id) ◄────────────── lookup_categories (lookup_id)
            ◄──────── findings (lookup_id)
            ◄──────── aggregated_results (lookup_id)

(rate_limit_counters has no FK to lookups by design — counters survive lookup purges.)
```

`ON DELETE CASCADE` from `lookups` → `lookup_categories`/`findings`/`aggregated_results` makes retention purge a single `DELETE FROM lookups WHERE …`.

---

## Validation rules (cross-referencing requirements)

| Rule | Source |
|------|--------|
| `identifier_value` length 2–80 after trim, type matches detection | FR-001, FR-002 |
| Only public-source `source_url`s; never store credentials/private data | FR-003, G2 |
| `lookups.status` lifecycle is one-directional and terminal | FR-005, FR-011 |
| Every `findings` row has a non-null `confidence` | FR-010 |
| Every completed lookup has exactly one `aggregated_results` row | FR-003, FR-007 |
| `enrichment_payload` is `NULL` and `enrichment_status='skipped'` in v1 | FR-014 (architectural reservation only) |
| `expires_at = created_at + interval '30 days'` | FR-016 |
| Rate-limit reads/writes never log raw `visitor_token` or raw `identifier_value` | FR-013, G2 |

---

## Out of v1, reserved by design

- **AI enrichment** consumes `aggregated_results.enrichment_*` columns; no schema change required to ship it.
- **Localised display** (Modern Standard Arabic vs Libyan Arabic, future English) consumes `findings.language` plus `display_label_ar` siblings on `source_categories`; no structural change.
- **Operator-tunable retention window** is one column-default change away — the schema does not hard-code 30 days as a `CHECK`.
