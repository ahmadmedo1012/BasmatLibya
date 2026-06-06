import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { i18nAr, type CategoryKey } from '@basmat/shared'
import { useLookup } from '../lib/queries.js'
import { ApiError } from '../lib/api.js'
import { getSocket, subscribeToLookup } from '../lib/socket.js'
import { Icon } from '../lib/icon.js'
import { CategorySection } from '../components/result/CategorySection.js'
import { EnrichmentSlot } from '../components/result/EnrichmentSlot.js'
import { ShareLinkButton } from '../components/result/ShareLinkButton.js'
import { ExpiredState } from '../components/states/ExpiredState.js'
import { FullFailureState } from '../components/states/FullFailureState.js'
import { EmptyState } from '../components/states/EmptyState.js'
import { DegradedState } from '../components/states/DegradedState.js'
import { NotFoundPage } from './NotFoundPage.js'
import { Button } from '../components/primitives/Button.js'

const CATEGORY_ICON: Record<CategoryKey, string> = {
  social_presence: 'share',
  public_mentions: 'public',
  contact_signals: 'contact_page',
  reputation_indicators: 'reviews',
  profile_imagery: 'face',
}

export function ResultPage({ id }: { id: string }) {
  const [_, setLocation] = useLocation()
  const qc = useQueryClient()
  const { data, error, isLoading, refetch } = useLookup(id, {
    refetchInterval: (q) => {
      const e = q.state.error
      if (e instanceof ApiError && e.status === 409) return 1500
      return false
    },
  })

  useEffect(() => {
    if (!id) return
    let cleanup = () => {}
    async function go() {
      const ack = await subscribeToLookup(id)
      if (!ack.ok) return
      const s = getSocket()
      const onUpdate = (e: { lookupId: string }) => {
        if (e.lookupId !== id) return
        qc.invalidateQueries({ queryKey: ['lookup', id] })
      }
      s.on('enrichment.ready', onUpdate)
      s.on('enrichment.failed', onUpdate)
      cleanup = () => {
        s.off('enrichment.ready', onUpdate)
        s.off('enrichment.failed', onUpdate)
      }
    }
    go()
    return () => cleanup()
  }, [id, qc])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20" aria-busy>
        <span className="inline-block size-6 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
      </div>
    )
  }

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage />
  }
  if (error instanceof ApiError && error.status === 409) {
    setTimeout(() => setLocation(`/lookups/${id}/progress`), 0)
    return null
  }
  if (!data) return <FullFailureState onRetry={() => refetch()} />
  if (data.status === 'expired') return <ExpiredState lookupId={data.id} />
  if (data.status === 'failed') return <FullFailureState onRetry={() => refetch()} />

  const totalFindings = data.totalFindings
  const failedCount = data.categories.filter((c) => c.state === 'failed').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-maxWidth mx-auto"
    >
      {/* Search Query Header */}
      <section className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-labelSm text-primary uppercase tracking-widest">
            تحليل الكيان
          </span>
          <h1 className="text-displayMobile font-bold text-ink break-words">
            {data.identifierValue}
          </h1>
          <p className="text-bodyMd text-inkSoft mt-1">{data.summaryHeadlineAr}</p>
        </div>
        <div className="hidden md:block">
          <ShareLinkButton lookupId={data.id} />
        </div>
      </section>

      {/* AI Summary — flagship card */}
      <section className="mb-10">
        <EnrichmentSlot enrichment={data.enrichment} />
      </section>

      {/* Identity disclaimer */}
      <div className="glass-card p-4 rounded-2xl border-warning/20 bg-warning/5 mb-8 flex items-start gap-3">
        <Icon name="info" className="text-warning shrink-0 mt-0.5" size={20} />
        <p className="text-bodyMd text-inkSoft">{i18nAr.ar.result.identityDisclaimer}</p>
      </div>

      {totalFindings === 0 ? (
        <EmptyState onRetry={() => setLocation('/')} />
      ) : (
        <>
          {failedCount > 0 ? (
            <div className="mb-6">
              <DegradedState />
            </div>
          ) : null}

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.categories.map((c) => (
              <CategorySection key={c.key} block={c} icon={CATEGORY_ICON[c.key]} />
            ))}
          </div>
        </>
      )}

      <div className="mt-12 flex justify-center">
        <Button variant="outline" onClick={() => setLocation('/')}>
          <Icon name="add" size={20} />
          بحث جديد
        </Button>
      </div>

      {/* Floating share button */}
      <div className="fixed bottom-24 left-6 z-40 md:hidden">
        <ShareLinkButton lookupId={data.id} floating />
      </div>
    </motion.div>
  )
}
