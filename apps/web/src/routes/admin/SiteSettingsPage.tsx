import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { i18nAr, type SiteSettingsMap, SITE_SETTING_KEYS } from '@basmat/shared'
import { getSiteSettings, patchSiteSettings, AdminApiError } from '../../lib/admin-api.js'

export function SiteSettingsPage() {
  const qc = useQueryClient()
  const labels = i18nAr.ar.admin.siteSettings
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'site-settings'],
    queryFn: getSiteSettings,
  })
  const [draft, setDraft] = useState<Partial<SiteSettingsMap>>({})
  const [savedFlag, setSavedFlag] = useState(false)

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  const save = useMutation({
    mutationFn: patchSiteSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'site-settings'] })
      setSavedFlag(true)
      setTimeout(() => setSavedFlag(false), 3000)
    },
  })

  if (isLoading) return <div className="text-inkMuted">جاري التحميل…</div>
  if (error instanceof AdminApiError) {
    return <div className="glass-card p-4 rounded-xl text-danger">{error.payload.messageAr}</div>
  }
  if (!data) return null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(draft)
      }}
      className="space-y-6 max-w-xl"
    >
      <h2 className="text-headlineMd font-bold text-ink">{i18nAr.ar.admin.sections.siteSettings}</h2>

      <Section title={labels.groups.toggles}>
        <ToggleRow
          k="enrichment_enabled"
          label={labels.keys.enrichment_enabled}
          value={draft.enrichment_enabled ?? data.enrichment_enabled}
          onChange={(v) => setDraft((d) => ({ ...d, enrichment_enabled: v }))}
        />
        <ToggleRow
          k="public_lookups_enabled"
          label={labels.keys.public_lookups_enabled}
          value={draft.public_lookups_enabled ?? data.public_lookups_enabled}
          onChange={(v) => setDraft((d) => ({ ...d, public_lookups_enabled: v }))}
        />
      </Section>

      <Section title={labels.groups.retention}>
        <NumberRow
          label={labels.keys.lookup_retention_days}
          value={draft.lookup_retention_days ?? data.lookup_retention_days}
          min={1}
          max={365}
          onChange={(v) => setDraft((d) => ({ ...d, lookup_retention_days: v }))}
        />
      </Section>

      <Section title={labels.groups.rateLimits}>
        <NumberRow
          label={labels.keys.rate_limit_per_visitor_window_minutes}
          value={draft.rate_limit_per_visitor_window_minutes ?? data.rate_limit_per_visitor_window_minutes}
          min={1}
          max={1440}
          onChange={(v) => setDraft((d) => ({ ...d, rate_limit_per_visitor_window_minutes: v }))}
        />
        <NumberRow
          label={labels.keys.rate_limit_per_visitor_max_per_window}
          value={draft.rate_limit_per_visitor_max_per_window ?? data.rate_limit_per_visitor_max_per_window}
          min={1}
          max={100}
          onChange={(v) => setDraft((d) => ({ ...d, rate_limit_per_visitor_max_per_window: v }))}
        />
        <NumberRow
          label={labels.keys.rate_limit_per_identifier_window_minutes}
          value={draft.rate_limit_per_identifier_window_minutes ?? data.rate_limit_per_identifier_window_minutes}
          min={1}
          max={1440}
          onChange={(v) => setDraft((d) => ({ ...d, rate_limit_per_identifier_window_minutes: v }))}
        />
        <NumberRow
          label={labels.keys.rate_limit_per_identifier_max_per_window}
          value={draft.rate_limit_per_identifier_max_per_window ?? data.rate_limit_per_identifier_max_per_window}
          min={1}
          max={1000}
          onChange={(v) => setDraft((d) => ({ ...d, rate_limit_per_identifier_max_per_window: v }))}
        />
      </Section>

      <Section title={labels.groups.sessions}>
        <NumberRow
          label={labels.keys.session_lifetime_days}
          value={draft.session_lifetime_days ?? data.session_lifetime_days}
          min={1}
          max={90}
          onChange={(v) => setDraft((d) => ({ ...d, session_lifetime_days: v }))}
        />
      </Section>

      <div className="flex items-center gap-3 pt-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="btn-red-gradient text-onPrimary px-5 py-2 rounded-lg font-semibold disabled:opacity-50"
        >
          {save.isPending ? '…' : 'حفظ'}
        </button>
        {savedFlag && <span className="text-success text-bodyMd">{labels.saved}</span>}
        {save.error instanceof AdminApiError && (
          <span className="text-danger text-bodyMd">{save.error.payload.messageAr}</span>
        )}
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="glass-card p-5 rounded-xl space-y-4">
      <legend className="text-bodyLg font-semibold text-ink px-2">{title}</legend>
      {children}
    </fieldset>
  )
}

function ToggleRow({
  k,
  label,
  value,
  onChange,
}: {
  k: string
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-bodyMd text-ink">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5"
        aria-label={label}
      />
    </label>
  )
}

function NumberRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-bodyMd text-ink">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-surface border border-outlineVariant rounded px-3 py-1.5 w-28 text-ink font-latin focus:border-primary outline-none"
      />
    </label>
  )
}
