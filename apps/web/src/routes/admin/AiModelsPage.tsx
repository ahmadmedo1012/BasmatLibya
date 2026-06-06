import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { i18nAr, type AiModelEntryDisplay, type AiModelProvider } from '@basmat/shared'
import {
  listAiModels,
  createAiModel,
  activateAiModel,
  deleteAiModel,
  AdminApiError,
} from '../../lib/admin-api.js'
import { cn } from '../../lib/cn.js'

const PROVIDER_LABELS = i18nAr.ar.admin.aiModels.providers
const PROVIDERS: AiModelProvider[] = ['openai', 'anthropic', 'google', 'nvidia', 'openai_compatible']

export function AiModelsPage() {
  const qc = useQueryClient()
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'ai-models'],
    queryFn: listAiModels,
  })
  const [showAdd, setShowAdd] = useState(false)
  const labels = i18nAr.ar.admin.aiModels

  const activate = useMutation({
    mutationFn: activateAiModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-models'] }),
  })
  const remove = useMutation({
    mutationFn: deleteAiModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-models'] }),
  })

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-headlineMd font-bold text-ink">{i18nAr.ar.admin.sections.aiModels}</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-red-gradient text-onPrimary px-4 py-2 rounded-lg text-bodyMd font-semibold shadow-glow"
        >
          {labels.add}
        </button>
      </header>

      {isLoading && <div className="text-inkMuted text-bodyMd">جاري التحميل…</div>}
      {error instanceof AdminApiError && (
        <div className="glass-card p-4 rounded-xl text-danger">{error.payload.messageAr}</div>
      )}

      <div className="grid gap-4">
        {entries.map((e) => (
          <ModelCard
            key={e.id}
            entry={e}
            onActivate={() => activate.mutate(e.id)}
            onDelete={() => {
              if (confirm(`${labels.delete}؟`)) remove.mutate(e.id)
            }}
          />
        ))}
        {!isLoading && entries.length === 0 && (
          <div className="glass-card p-6 rounded-xl text-bodyMd text-inkMuted text-center">
            لا توجد نماذج بعد. اضغط "{labels.add}" للبدء.
          </div>
        )}
      </div>

      {showAdd && <AddModelDialog onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function ModelCard({
  entry,
  onActivate,
  onDelete,
}: {
  entry: AiModelEntryDisplay
  onActivate: () => void
  onDelete: () => void
}) {
  const labels = i18nAr.ar.admin.aiModels
  return (
    <div className={cn('glass-card p-4 rounded-xl', entry.isActive && 'border-primary/40 ai-glow')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-ink">
              {entry.displayLabel || `${PROVIDER_LABELS[entry.provider]} / ${entry.modelId}`}
            </span>
            {entry.isActive && (
              <span className="pill bg-primarySoft text-primary">{labels.activeBadge}</span>
            )}
            {entry.status === 'invalid' && (
              <span className="pill bg-warning/10 text-warning">⚠ {entry.lastValidationError}</span>
            )}
          </div>
          <div className="text-labelSm text-inkMuted font-latin">
            {entry.provider} · {entry.modelId} · •••• {entry.credential.lastFour}
          </div>
        </div>
        <div className="flex gap-2">
          {!entry.isActive && (
            <button
              onClick={onActivate}
              className="text-labelMd text-primary border border-primary/40 rounded px-3 py-1 hover:bg-primarySoft transition-colors"
            >
              {labels.activate}
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={entry.isActive}
            className="text-labelMd text-danger border border-danger/30 rounded px-3 py-1 hover:bg-dangerSoft transition-colors disabled:opacity-30"
          >
            {labels.delete}
          </button>
        </div>
      </div>
      <div className="text-labelSm text-inkMuted">
        T={entry.generation.temperature} · max={entry.generation.maxOutputTokens}
      </div>
    </div>
  )
}

function AddModelDialog({ onClose }: { onClose: () => void }) {
  const labels = i18nAr.ar.admin.aiModels
  const fields = labels.fields
  const qc = useQueryClient()
  const [provider, setProvider] = useState<AiModelProvider>('openai')
  const [modelId, setModelId] = useState('')
  const [displayLabel, setDisplayLabel] = useState('')
  const [credential, setCredential] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState('0.2')
  const [maxOutputTokens, setMaxOutputTokens] = useState('1024')
  const [extraParams, setExtraParams] = useState('{}')

  const create = useMutation({
    mutationFn: createAiModel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ai-models'] })
      onClose()
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    let extra: Record<string, unknown> = {}
    try {
      extra = JSON.parse(extraParams || '{}')
    } catch {
      alert('extraParams JSON غير صالح')
      return
    }
    create.mutate({
      provider,
      modelId: modelId.trim(),
      displayLabel: displayLabel.trim() || null,
      credential,
      baseUrl: baseUrl.trim() || null,
      generation: {
        systemPrompt,
        temperature: Number(temperature),
        maxOutputTokens: Number(maxOutputTokens),
        extraParams: extra,
      },
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="glass-card-strong rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[92vh] overflow-y-auto"
      >
        <h3 className="text-headlineMd font-bold text-ink">{labels.add}</h3>

        <Field label={fields.provider}>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiModelProvider)}
            className="bg-surface border border-outlineVariant rounded px-3 py-2 w-full text-ink"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={fields.modelId}>
          <input value={modelId} onChange={(e) => setModelId(e.target.value)} required className={inputCls} />
        </Field>
        <Field label={fields.displayLabel}>
          <input value={displayLabel} onChange={(e) => setDisplayLabel(e.target.value)} className={inputCls} />
        </Field>
        <Field label={fields.credential}>
          <input
            type="password"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder={fields.credentialPlaceholder}
            required
            className={inputCls}
          />
        </Field>
        {(provider === 'openai_compatible' || provider === 'nvidia') && (
          <Field label={fields.baseUrl}>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={inputCls} />
          </Field>
        )}
        <Field label={fields.systemPrompt}>
          <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className={`${inputCls} min-h-[80px]`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={fields.temperature}>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={fields.maxOutputTokens}>
            <input
              type="number"
              min="16"
              max="32000"
              value={maxOutputTokens}
              onChange={(e) => setMaxOutputTokens(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label={fields.extraParams}>
          <textarea
            value={extraParams}
            onChange={(e) => setExtraParams(e.target.value)}
            className={`${inputCls} font-latin text-labelMd`}
          />
        </Field>

        {create.error instanceof AdminApiError && (
          <div className="text-danger text-bodyMd">{create.error.payload.messageAr}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-inkMuted px-3 py-2">
            تراجع
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="btn-red-gradient text-onPrimary px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {create.isPending ? labels.validation.running : labels.add}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls =
  'bg-surface border border-outlineVariant rounded px-3 py-2 w-full text-ink focus:border-primary outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-labelMd text-inkSoft mb-1 block">{label}</span>
      {children}
    </label>
  )
}
