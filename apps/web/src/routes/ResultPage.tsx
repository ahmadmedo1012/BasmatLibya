import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { i18nAr, type CategoryKey } from '@basmat/shared'
import { MockLookupService } from '../data/mock-lookup.js'
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

  const data = MockLookupService.getLookup(id)

  useEffect(() => {
    if (!id) return
    return MockLookupService.onEnrichmentUpdate(id, () => {})
  }, [id])

  if (!data) return <FullFailureState onRetry={() => {}} />
  if (data.status === 'expired') return <ExpiredState lookupId={data.id} />
  if (data.status === 'failed') return <FullFailureState onRetry={() => {}} />

  const totalFindings = data.totalFindings
  const failedCount = data.categories.filter((c) => c.state === 'failed').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-maxWidth mx-auto"
    >
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

      <section className="mb-10">
        <EnrichmentSlot enrichment={data.enrichment} />
      </section>

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

      <div className="fixed bottom-24 left-6 z-40 md:hidden">
        <ShareLinkButton lookupId={data.id} floating />
      </div>
    </motion.div>
  )
}
