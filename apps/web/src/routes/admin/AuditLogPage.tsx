import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { i18nAr, type AuditEntry } from '@basmat/shared'
import { listAudit, AdminApiError } from '../../lib/admin-api.js'
import { cn } from '../../lib/cn.js'

export function AuditLogPage() {
  const labels = i18nAr.ar.admin.audit
  const [filter, setFilter] = useState<'all' | 'auth' | 'admin'>('all')
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'audit', filter],
    queryFn: () =>
      listAudit({
        eventClass: filter === 'all' ? undefined : filter,
        limit: 50,
      }),
  })

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-headlineMd font-bold text-ink mb-3">{labels.heading}</h2>
        <div className="flex gap-2">
          <Chip label={labels.filters.all} active={filter === 'all'} onClick={() => setFilter('all')} />
          <Chip label={labels.filters.auth} active={filter === 'auth'} onClick={() => setFilter('auth')} />
          <Chip label={labels.filters.admin} active={filter === 'admin'} onClick={() => setFilter('admin')} />
        </div>
      </header>

      {isLoading && <div className="text-inkMuted">جاري التحميل…</div>}
      {error instanceof AdminApiError && (
        <div className="glass-card p-4 rounded-xl text-danger">{error.payload.messageAr}</div>
      )}

      {data && data.items.length === 0 && (
        <div className="glass-card p-6 rounded-xl text-bodyMd text-inkMuted text-center">{labels.empty}</div>
      )}

      <div className="space-y-2">
        {(data?.items ?? []).map((entry) => (
          <Row key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}

function Row({ entry }: { entry: AuditEntry }) {
  const labels = i18nAr.ar.admin.audit
  const verbs = labels.verbs as Record<string, string>
  const verb = verbs[entry.eventSubclass] ?? entry.eventSubclass
  return (
    <div className="glass-card p-4 rounded-xl">
      <div className="flex flex-wrap items-baseline gap-2 mb-2">
        <span className={cn('pill', entry.eventClass === 'admin' ? 'bg-primarySoft text-primary' : 'bg-surfaceContainerHigh text-inkSoft')}>
          {entry.eventClass === 'admin' ? labels.filters.admin : labels.filters.auth}
        </span>
        <span className="text-bodyMd text-ink font-semibold">{verb}</span>
        {entry.targetKind && (
          <span className="text-labelMd text-inkMuted font-latin">
            {entry.targetKind}:{(entry.targetId ?? '').slice(0, 8)}
          </span>
        )}
        <span className="text-labelSm text-inkMuted ms-auto font-latin">
          {new Date(entry.createdAt).toLocaleString('ar-LY')}
        </span>
      </div>
      {entry.actor && (
        <div className="text-labelMd text-inkSoft mb-2">
          بواسطة <span className="text-ink">{entry.actor.displayName}</span>
        </div>
      )}
      {(entry.beforeValue !== null || entry.afterValue !== null) && (
        <details className="text-labelSm">
          <summary className="cursor-pointer text-inkMuted">التفاصيل</summary>
          <div className="grid sm:grid-cols-2 gap-3 mt-2 font-latin">
            {entry.beforeValue !== null && entry.beforeValue !== undefined && (
              <pre className="bg-surfaceContainer rounded p-2 overflow-x-auto text-xs">
                {JSON.stringify(entry.beforeValue, null, 2) ?? ''}
              </pre>
            )}
            {entry.afterValue !== null && entry.afterValue !== undefined && (
              <pre className="bg-surfaceContainer rounded p-2 overflow-x-auto text-xs">
                {JSON.stringify(entry.afterValue, null, 2) ?? ''}
              </pre>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'pill border transition-colors',
        active ? 'bg-primarySoft text-primary border-primary/40' : 'bg-surfaceContainerLow text-inkSoft border-outlineVariant/40'
      )}
    >
      {label}
    </button>
  )
}
