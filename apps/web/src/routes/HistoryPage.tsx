import { Link } from 'wouter'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { i18nAr, HistoryPageSchema, ErrorResponseSchema, type LookupHistoryItem } from '@basmat/shared'
import { z } from 'zod'
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { usePrincipal, getCsrfToken } from '../lib/auth.js'
import { ApiError } from '../lib/api.js'
import { cn } from '../lib/cn.js'

async function fetchHistory(): Promise<LookupHistoryItem[]> {
  const res = await fetch('/api/me/history?limit=50', { credentials: 'include' })
  if (!res.ok) {
    const body = ErrorResponseSchema.safeParse(await res.json().catch(() => ({})))
    throw new ApiError(
      res.status,
      body.success ? body.data : { code: 'lookup_not_found', messageAr: '', retryAfterSeconds: null }
    )
  }
  const parsed = HistoryPageSchema.parse(await res.json())
  return parsed.items
}

async function hideEntry(lookupId: string): Promise<void> {
  const csrf = getCsrfToken()
  const res = await fetch(`/api/me/history/${lookupId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: csrf ? { 'X-CSRF': csrf } : undefined,
  })
  if (!res.ok && res.status !== 204) throw new Error(`hide failed: ${res.status}`)
}

export function HistoryPage() {
  const principal = usePrincipal()
  const [, setLocation] = useLocation()
  const qc = useQueryClient()

  useEffect(() => {
    if (principal === null) {
      setLocation('/sign-in?next=%2Fhistory')
    }
  }, [principal, setLocation])

  const { data: items, isLoading } = useQuery({
    queryKey: ['me', 'history'],
    queryFn: fetchHistory,
    enabled: !!principal,
  })

  const hide = useMutation({
    mutationFn: hideEntry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'history'] }),
  })

  if (!principal) return null
  if (isLoading) return <div className="text-inkMuted py-12 text-center">جاري التحميل…</div>

  if (!items || items.length === 0) {
    return <HistoryEmpty />
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-headlineLg font-bold text-ink mb-2">{i18nAr.ar.history.heading}</h1>
      {items.map((item) => (
        <HistoryRow
          key={item.lookupId}
          item={item}
          onHide={() => {
            if (confirm(i18nAr.ar.history.removeConfirm.body)) hide.mutate(item.lookupId)
          }}
        />
      ))}
    </div>
  )
}

function HistoryRow({ item, onHide }: { item: LookupHistoryItem; onHide: () => void }) {
  const labels = i18nAr.ar.history
  const statusLabels: Record<LookupHistoryItem['status'], string> = {
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
    failed: 'تعذّر',
    cancelled: 'مُلغى',
    expired: 'منتهٍ',
  }
  return (
    <div className="glass-card p-4 rounded-xl flex items-center justify-between gap-3">
      <Link href={`/lookups/${item.lookupId}`} className="flex-1">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'pill',
              item.status === 'completed'
                ? 'bg-success/10 text-success'
                : item.status === 'expired'
                ? 'bg-inkMuted/10 text-inkMuted'
                : 'bg-warning/10 text-warning'
            )}
          >
            {statusLabels[item.status]}
          </span>
          <div>
            <div className="text-ink text-bodyMd">{item.identifierPreview}</div>
            <div className="text-labelSm text-inkMuted font-latin">
              {new Date(item.createdAt).toLocaleString('ar-LY')}
            </div>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          onHide()
        }}
        className="text-labelMd text-danger border border-danger/30 rounded px-3 py-1 hover:bg-dangerSoft transition-colors"
      >
        {labels.remove}
      </button>
    </div>
  )
}

function HistoryEmpty() {
  const labels = i18nAr.ar.history.empty
  return (
    <div className="max-w-md mx-auto py-12 text-center">
      <div className="glass-card p-8 rounded-2xl">
        <h2 className="text-headlineMd font-bold text-ink mb-3">{labels.title}</h2>
        <p className="text-bodyMd text-inkSoft mb-6">{labels.body}</p>
        <Link href="/" className="btn-red-gradient text-onPrimary px-5 py-2 rounded-lg font-semibold inline-block">
          {labels.cta}
        </Link>
      </div>
    </div>
  )
}
