import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import {
  type CategoryKey,
  type CategoryState,
  i18nAr,
} from '@basmat/shared'
import { getSocket, subscribeToLookup, unsubscribeFromLookup } from '../lib/socket.js'
import { Button } from '../components/primitives/Button.js'
import { Icon } from '../lib/icon.js'
import { useCancelLookup } from '../lib/queries.js'
import { showToast } from '../components/primitives/Toast.js'
import { NotFoundPage } from './NotFoundPage.js'
import { cn } from '../lib/cn.js'

interface CategoryView {
  key: CategoryKey
  state: CategoryState
  findingsCount: number
  failureReason: string | null
}

const CATEGORY_ORDER: CategoryKey[] = [
  'social_presence',
  'public_mentions',
  'contact_signals',
  'reputation_indicators',
  'profile_imagery',
]

const CATEGORY_ICON: Record<CategoryKey, string> = {
  social_presence: 'share',
  public_mentions: 'public',
  contact_signals: 'contact_page',
  reputation_indicators: 'reviews',
  profile_imagery: 'face',
}

export function ProgressPage({ id }: { id: string }) {
  const [_loc, setLocation] = useLocation()
  const [categories, setCategories] = useState<Map<CategoryKey, CategoryView>>(new Map())
  const [notFound, setNotFound] = useState(false)
  const cancel = useCancelLookup()

  useEffect(() => {
    let active = true
    let cleanup = () => {}

    async function go() {
      const ack = await subscribeToLookup(id)
      if (!active) return
      if (!ack.ok) {
        setNotFound(true)
        return
      }
      const m = new Map<CategoryKey, CategoryView>()
      for (const k of CATEGORY_ORDER) {
        const c = ack.replay.categories.find((c) => c.key === k)
        m.set(k, {
          key: k,
          state: c?.state ?? 'queued',
          findingsCount: c?.findingsSoFar.length ?? 0,
          failureReason: c?.failureReason ?? null,
        })
      }
      setCategories(m)

      if (
        ack.replay.status === 'completed' ||
        ack.replay.status === 'failed' ||
        ack.replay.status === 'cancelled' ||
        ack.replay.status === 'expired'
      ) {
        setLocation(`/lookups/${id}`)
        return
      }

      const s = getSocket()
      const onStarted = (e: { lookupId: string; categoryKey: CategoryKey }) => {
        if (e.lookupId !== id) return
        setCategories((cur) => {
          const next = new Map(cur)
          const v = next.get(e.categoryKey)
          if (v) next.set(e.categoryKey, { ...v, state: 'running' })
          return next
        })
      }
      const onFinding = (e: { lookupId: string; categoryKey: CategoryKey }) => {
        if (e.lookupId !== id) return
        setCategories((cur) => {
          const next = new Map(cur)
          const v = next.get(e.categoryKey)
          if (v) next.set(e.categoryKey, { ...v, findingsCount: v.findingsCount + 1 })
          return next
        })
      }
      const onCompleted = (e: { lookupId: string; categoryKey: CategoryKey }) => {
        if (e.lookupId !== id) return
        setCategories((cur) => {
          const next = new Map(cur)
          const v = next.get(e.categoryKey)
          if (v) next.set(e.categoryKey, { ...v, state: 'completed' })
          return next
        })
      }
      const onFailed = (e: {
        lookupId: string
        categoryKey: CategoryKey
        failureReason: string
      }) => {
        if (e.lookupId !== id) return
        setCategories((cur) => {
          const next = new Map(cur)
          const v = next.get(e.categoryKey)
          if (v) next.set(e.categoryKey, { ...v, state: 'failed', failureReason: e.failureReason })
          return next
        })
      }
      const onSkipped = (e: { lookupId: string; categoryKey: CategoryKey }) => {
        if (e.lookupId !== id) return
        setCategories((cur) => {
          const next = new Map(cur)
          const v = next.get(e.categoryKey)
          if (v) next.set(e.categoryKey, { ...v, state: 'skipped' })
          return next
        })
      }
      const onLookupCompleted = (e: { lookupId: string }) => {
        if (e.lookupId !== id) return
        setLocation(`/lookups/${id}`)
      }
      const onLookupFailed = (e: { lookupId: string }) => {
        if (e.lookupId !== id) return
        setLocation(`/lookups/${id}`)
      }
      const onLookupCancelled = (e: { lookupId: string }) => {
        if (e.lookupId !== id) return
        setLocation('/')
      }

      s.on('category.started', onStarted)
      s.on('category.finding', onFinding)
      s.on('category.completed', onCompleted)
      s.on('category.failed', onFailed)
      s.on('category.skipped', onSkipped)
      s.on('lookup.completed', onLookupCompleted)
      s.on('lookup.failed', onLookupFailed)
      s.on('lookup.cancelled', onLookupCancelled)

      cleanup = () => {
        s.off('category.started', onStarted)
        s.off('category.finding', onFinding)
        s.off('category.completed', onCompleted)
        s.off('category.failed', onFailed)
        s.off('category.skipped', onSkipped)
        s.off('lookup.completed', onLookupCompleted)
        s.off('lookup.failed', onLookupFailed)
        s.off('lookup.cancelled', onLookupCancelled)
        unsubscribeFromLookup(id)
      }
    }

    go()
    return () => {
      active = false
      cleanup()
    }
  }, [id, setLocation])

  const overall = useMemo(() => {
    const all = Array.from(categories.values())
    if (all.length === 0) return 0
    const settled = all.filter(
      (c) => c.state === 'completed' || c.state === 'failed' || c.state === 'skipped'
    ).length
    return Math.round((settled / all.length) * 100)
  }, [categories])

  if (notFound) return <NotFoundPage />

  async function onCancel() {
    try {
      await cancel.mutateAsync(id)
      showToast(i18nAr.ar.progress.cancelConfirm, 'info')
      setLocation('/')
    } catch {
      showToast(i18nAr.ar.errors.generic, 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <span className="text-labelSm text-primary uppercase tracking-widest">
          جاري التحليل
        </span>
        <h1 className="text-displayMobile font-bold text-ink mt-2">
          {i18nAr.ar.progress.heading}
        </h1>
        <p className="mt-3 text-bodyMd text-inkSoft">{i18nAr.ar.progress.subheading}</p>
      </div>

      {/* Overall progress bar */}
      <div className="glass-card rounded-3xl p-2 overflow-hidden mb-8">
        <div className="h-2 bg-surfaceContainerLowest rounded-full overflow-hidden">
          <motion.div
            className="h-full btn-red-gradient rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${overall}%` }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
          />
        </div>
      </div>

      {/* Category list */}
      <ul className="grid gap-3">
        {CATEGORY_ORDER.map((k) => {
          const v = categories.get(k)
          const state: CategoryState = v?.state ?? 'queued'
          return (
            <motion.li
              key={k}
              layout
              className={cn(
                'glass-card rounded-2xl px-5 py-4 flex items-center justify-between transition-colors',
                state === 'running' && 'border-primary/40 ai-glow',
                state === 'completed' && 'border-primary/30',
                state === 'failed' && 'border-warning/40'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'size-10 rounded-2xl flex items-center justify-center transition-colors',
                    state === 'running' && 'bg-primary/15 text-primary animate-pulse',
                    state === 'completed' && 'bg-primary/10 text-primary',
                    state === 'failed' && 'bg-warning/10 text-warning',
                    state === 'queued' && 'bg-surfaceContainer text-inkMuted',
                    state === 'skipped' && 'bg-surfaceContainerLowest text-inkDim'
                  )}
                >
                  <Icon name={CATEGORY_ICON[k]} size={20} />
                </div>
                <div>
                  <div className="text-bodyMd text-ink font-medium">
                    {i18nAr.ar.categories[k]}
                  </div>
                  <div className="text-labelSm text-inkMuted mt-0.5">
                    {i18nAr.ar.categoryStates[state]}
                    {v && v.findingsCount > 0 ? ` · ${v.findingsCount} نتيجة` : ''}
                  </div>
                </div>
              </div>
              <StateIcon state={state} />
            </motion.li>
          )
        })}
      </ul>

      <div className="mt-10 flex justify-center">
        <Button variant="ghost" onClick={onCancel} loading={cancel.isPending}>
          <Icon name="close" size={18} />
          {cancel.isPending ? i18nAr.ar.progress.cancelling : i18nAr.ar.progress.cancel}
        </Button>
      </div>

    </motion.div>
  )
}

function StateIcon({ state }: { state: CategoryState }) {
  if (state === 'completed') {
    return <Icon name="check_circle" fill className="text-primary" size={22} />
  }
  if (state === 'failed') {
    return <Icon name="error" className="text-warning" size={22} />
  }
  if (state === 'running') {
    return (
      <span className="inline-block size-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
    )
  }
  if (state === 'skipped') {
    return <Icon name="remove_circle" className="text-inkDim" size={20} />
  }
  return <Icon name="schedule" className="text-inkMuted" size={20} />
}
