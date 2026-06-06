import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
  jsonb,
  bigint,
  numeric,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ============================================================================
// Feature 001 — unchanged. Do NOT alter these tables in this feature (G10).
// ============================================================================

export const sourceCategories = pgTable('source_categories', {
  key: text('key').primaryKey(),
  displayLabelAr: text('display_label_ar').notNull(),
  orderingWeight: integer('ordering_weight').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
})

export const lookups = pgTable(
  'lookups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifierValue: text('identifier_value').notNull(),
    identifierValueNormalised: text('identifier_value_normalised').notNull(),
    identifierType: text('identifier_type').notNull(),
    status: text('status').notNull(),
    visitorTokenHash: text('visitor_token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    failureReason: text('failure_reason'),
    // Feature 002 additive: nullable, FK SET NULL on delete (preserves share links).
    ownerUserId: uuid('owner_user_id'),
  },
  (t) => ({
    identifierTypeCheck: check(
      'lookups_identifier_type_check',
      sql`${t.identifierType} in ('name','username','email','phone')`
    ),
    statusCheck: check(
      'lookups_status_check',
      sql`${t.status} in ('in_progress','completed','cancelled','failed')`
    ),
    visitorIdx: index('lookups_visitor_token_created_idx').on(t.visitorTokenHash, t.createdAt),
    identifierIdx: index('lookups_identifier_norm_created_idx').on(
      t.identifierValueNormalised,
      t.createdAt
    ),
    statusExpiresIdx: index('lookups_status_expires_idx').on(t.status, t.expiresAt),
    ownerIdx: index('lookups_owner_user_idx').on(t.ownerUserId),
  })
)

export const lookupCategories = pgTable(
  'lookup_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lookupId: uuid('lookup_id')
      .notNull()
      .references(() => lookups.id, { onDelete: 'cascade' }),
    categoryKey: text('category_key')
      .notNull()
      .references(() => sourceCategories.key),
    state: text('state').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
  },
  (t) => ({
    stateCheck: check(
      'lookup_categories_state_check',
      sql`${t.state} in ('queued','running','completed','failed','skipped')`
    ),
    uniq: uniqueIndex('lookup_categories_lookup_cat_uniq').on(t.lookupId, t.categoryKey),
    stateIdx: index('lookup_categories_lookup_state_idx').on(t.lookupId, t.state),
  })
)

export const findings = pgTable(
  'findings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lookupId: uuid('lookup_id')
      .notNull()
      .references(() => lookups.id, { onDelete: 'cascade' }),
    categoryKey: text('category_key')
      .notNull()
      .references(() => sourceCategories.key),
    title: text('title').notNull(),
    snippet: text('snippet'),
    sourceUrl: text('source_url'),
    sourceName: text('source_name').notNull(),
    language: text('language'),
    confidence: text('confidence').notNull(),
    orderingWeight: integer('ordering_weight').notNull().default(0),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    confidenceCheck: check(
      'findings_confidence_check',
      sql`${t.confidence} in ('high','medium','low')`
    ),
    renderIdx: index('findings_lookup_cat_order_idx').on(
      t.lookupId,
      t.categoryKey,
      t.orderingWeight
    ),
    lookupIdx: index('findings_lookup_idx').on(t.lookupId),
  })
)

export const aggregatedResults = pgTable(
  'aggregated_results',
  {
    lookupId: uuid('lookup_id')
      .primaryKey()
      .references(() => lookups.id, { onDelete: 'cascade' }),
    summaryHeadlineAr: text('summary_headline_ar').notNull(),
    totalFindings: integer('total_findings').notNull(),
    populatedCategories: text('populated_categories').array().notNull(),
    enrichmentStatus: text('enrichment_status').notNull().default('skipped'),
    enrichmentPayload: jsonb('enrichment_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    enrichmentCheck: check(
      'aggregated_results_enrichment_check',
      sql`${t.enrichmentStatus} in ('skipped','pending','ready','failed')`
    ),
  })
)

export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    visitorTokenHash: text('visitor_token_hash').notNull(),
    identifierHash: text('identifier_hash').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.visitorTokenHash, t.identifierHash, t.windowStart] }),
    expiresIdx: index('rate_limit_expires_idx').on(t.expiresAt),
  })
)

// ============================================================================
// Feature 002 — additive tables.
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    telegramId: bigint('telegram_id', { mode: 'bigint' }).notNull(),
    displayName: text('display_name').notNull(),
    username: text('username'),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('user'),
    status: text('status').notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  },
  (t) => ({
    roleCheck: check('users_role_check', sql`${t.role} in ('owner','user')`),
    statusCheck: check('users_status_check', sql`${t.status} in ('active','suspended')`),
    telegramUniq: uniqueIndex('users_telegram_id_uniq').on(t.telegramId),
    roleStatusIdx: index('users_role_status_idx').on(t.role, t.status),
    lastSeenIdx: index('users_last_seen_idx').on(t.lastSeenAt),
  })
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    csrfToken: text('csrf_token').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
    clientSignature: text('client_signature').notNull(),
  },
  (t) => ({
    revokeReasonCheck: check(
      'sessions_revoke_reason_check',
      sql`${t.revokeReason} is null or ${t.revokeReason} in ('sign_out','suspended','removed','manual','expired','rotated')`
    ),
    tokenHashUniq: uniqueIndex('sessions_token_hash_uniq').on(t.tokenHash),
    userRevokedIdx: index('sessions_user_revoked_idx').on(t.userId, t.revokedAt),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  })
)

export const aiModelEntries = pgTable(
  'ai_model_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    modelId: text('model_id').notNull(),
    displayLabel: text('display_label'),
    baseUrl: text('base_url'),
    credentialCiphertext: jsonb('credential_ciphertext').notNull(),
    credentialLastFour: text('credential_last_four').notNull(),
    systemPrompt: text('system_prompt').notNull().default(''),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).notNull().default('0.20'),
    maxOutputTokens: integer('max_output_tokens').notNull().default(1024),
    extraParams: jsonb('extra_params').notNull().default(sql`'{}'::jsonb`),
    status: text('status').notNull().default('inactive'),
    isActive: boolean('is_active').notNull().default(false),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    lastValidationError: text('last_validation_error'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedBy: uuid('last_updated_by').references(() => users.id, { onDelete: 'set null' }),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerCheck: check(
      'ai_model_entries_provider_check',
      sql`${t.provider} in ('openai','anthropic','google','nvidia','openai_compatible')`
    ),
    statusCheck: check(
      'ai_model_entries_status_check',
      sql`${t.status} in ('active','inactive','invalid')`
    ),
    tempCheck: check(
      'ai_model_entries_temp_check',
      sql`${t.temperature} >= 0 and ${t.temperature} <= 2`
    ),
    tokensCheck: check(
      'ai_model_entries_tokens_check',
      sql`${t.maxOutputTokens} >= 16 and ${t.maxOutputTokens} <= 32000`
    ),
    // Partial unique index: at most one row may have is_active=true (FR-013).
    oneActive: uniqueIndex('one_active_ai_model').on(t.isActive).where(sql`${t.isActive} = true`),
    providerModelIdx: index('ai_model_entries_provider_model_idx').on(t.provider, t.modelId),
    statusUpdatedIdx: index('ai_model_entries_status_updated_idx').on(t.status, t.lastUpdatedAt),
  })
)

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  lastUpdatedBy: uuid('last_updated_by').references(() => users.id, { onDelete: 'set null' }),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogEntries = pgTable(
  'audit_log_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    eventClass: text('event_class').notNull(),
    eventSubclass: text('event_subclass').notNull(),
    targetKind: text('target_kind'),
    targetId: text('target_id'),
    beforeValue: jsonb('before_value'),
    afterValue: jsonb('after_value'),
    requestSignature: text('request_signature'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    classCheck: check('audit_event_class_check', sql`${t.eventClass} in ('auth','admin')`),
    classCreatedIdx: index('audit_class_created_idx').on(t.eventClass, t.createdAt),
    actorCreatedIdx: index('audit_actor_created_idx').on(t.actorUserId, t.createdAt),
    targetCreatedIdx: index('audit_target_created_idx').on(t.targetKind, t.targetId, t.createdAt),
  })
)

export const userLookupAssociations = pgTable(
  'user_lookup_associations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lookupId: uuid('lookup_id')
      .notNull()
      .references(() => lookups.id, { onDelete: 'cascade' }),
    associatedAt: timestamp('associated_at', { withTimezone: true }).notNull().defaultNow(),
    hiddenByUserAt: timestamp('hidden_by_user_at', { withTimezone: true }),
  },
  (t) => ({
    uniq: uniqueIndex('user_lookup_assoc_uniq').on(t.userId, t.lookupId),
    userHiddenIdx: index('user_lookup_assoc_user_hidden_idx').on(
      t.userId,
      t.hiddenByUserAt,
      t.associatedAt
    ),
    lookupIdx: index('user_lookup_assoc_lookup_idx').on(t.lookupId),
  })
)
