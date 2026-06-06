import { motion, AnimatePresence } from 'framer-motion'
import type { EnrichmentSlot as EnrichmentSlotType, EnrichmentPayload } from '@basmat/shared'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { cn } from '../../lib/cn.js'

const CONFIDENCE_LABEL = {
  high: i18nAr.ar.result.confidenceHigh,
  medium: i18nAr.ar.result.confidenceMedium,
  low: i18nAr.ar.result.confidenceLow,
} as const

const CONFIDENCE_TONE = {
  high: 'bg-primary/15 text-primary border border-primary/30',
  medium: 'bg-warning/15 text-warning border border-warning/30',
  low: 'bg-surfaceVariant text-inkMuted border border-outlineVariant',
} as const

export function EnrichmentSlot({ enrichment }: { enrichment: EnrichmentSlotType }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {enrichment.status === 'pending' ? (
        <motion.div
          key="pending"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="glass-card-strong ai-glow rounded-3xl p-6 relative overflow-hidden border-l-4 border-l-primary"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
              <Icon name="psychology" fill className="text-primary" />
            </div>
            <h3 className="text-headlineMd text-primary">{i18nAr.ar.enrichment.badge}</h3>
          </div>
          <div className="text-bodyLg text-ink leading-relaxed flex items-center gap-3">
            <span className="inline-block size-3 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
            <span>{i18nAr.ar.enrichment.pending}</span>
          </div>
          <p className="mt-2 text-bodyMd text-inkMuted">{i18nAr.ar.enrichment.pendingHint}</p>
          <div className="mt-5 space-y-2.5">
            <div className="h-3 w-3/4 rounded-md bg-outlineVariant/50 animate-pulse" />
            <div className="h-3 w-2/3 rounded-md bg-outlineVariant/50 animate-pulse" />
            <div className="h-3 w-1/2 rounded-md bg-outlineVariant/50 animate-pulse" />
          </div>
        </motion.div>
      ) : enrichment.status === 'ready' && enrichment.payload ? (
        <ReadyCard key="ready" payload={enrichment.payload} />
      ) : enrichment.status === 'failed' ? (
        <motion.div
          key="failed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-4 rounded-2xl text-bodyMd text-inkMuted border-warning/20 flex items-start gap-3"
        >
          <Icon name="error" className="text-warning shrink-0 mt-0.5" size={20} />
          <p>{i18nAr.ar.enrichment.failed}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function ReadyCard({ payload }: { payload: EnrichmentPayload }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-strong ai-glow rounded-3xl relative overflow-hidden border-l-4 border-l-primary"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />

      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
            <Icon name="psychology" fill className="text-primary" />
          </div>
          <h3 className="text-headlineMd text-primary">{i18nAr.ar.enrichment.badge}</h3>
        </div>

        <h4 className="text-headlineMd text-ink leading-snug mb-3">{payload.headlineAr}</h4>
        <p className="text-bodyLg text-ink leading-relaxed">{payload.summaryAr}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="pill bg-primary/20 text-primary border border-primary/30">{i18nAr.ar.enrichment.accuracyPill}</span>
          <span className="pill bg-onPrimaryContainer/15 text-onPrimaryContainer border border-onPrimaryContainer/20">
            {i18nAr.ar.enrichment.sourcePill}
          </span>
        </div>
      </div>

      {payload.highlightsAr.length > 0 ? (
        <Section title={i18nAr.ar.enrichment.highlightsTitle}>
          <ul className="grid gap-2">
            {payload.highlightsAr.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-bodyMd text-ink leading-relaxed">
                <Icon name="auto_awesome" size={16} className="text-primary mt-0.5 shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {payload.identityClusters.length > 0 ? (
        <Section title={i18nAr.ar.enrichment.clustersTitle}>
          <div className="grid gap-3 sm:grid-cols-2">
            {payload.identityClusters.map((c, i) => (
              <div
                key={i}
                className="rounded-2xl border border-outlineVariant/30 bg-surfaceContainerLow p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-ink font-medium text-bodyMd">{c.labelAr}</div>
                  <span className={cn('pill shrink-0', CONFIDENCE_TONE[c.confidence])}>
                    {CONFIDENCE_LABEL[c.confidence]}
                  </span>
                </div>
                {c.rationaleAr ? (
                  <p className="mt-2 text-labelSm text-inkMuted leading-relaxed">{c.rationaleAr}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {payload.riskFlagsAr.length > 0 || payload.gapsAr.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-0 border-t border-outlineVariant/30">
          {payload.riskFlagsAr.length > 0 ? (
            <div className="px-6 py-5">
              <h4 className="text-labelSm uppercase tracking-wider text-warning mb-3 flex items-center gap-2">
                <Icon name="warning" size={16} />
                {i18nAr.ar.enrichment.risksTitle}
              </h4>
              <ul className="space-y-1.5">
                {payload.riskFlagsAr.map((r, i) => (
                  <li key={i} className="text-bodyMd text-ink/90 flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 rounded-full bg-warning shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {payload.gapsAr.length > 0 ? (
            <div className="px-6 py-5 sm:border-s border-outlineVariant/30">
              <h4 className="text-labelSm uppercase tracking-wider text-inkSoft mb-3 flex items-center gap-2">
                <Icon name="search_off" size={16} />
                {i18nAr.ar.enrichment.gapsTitle}
              </h4>
              <ul className="space-y-1.5">
                {payload.gapsAr.map((g, i) => (
                  <li key={i} className="text-bodyMd text-ink/90 flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 rounded-full bg-inkSoft shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Footer */}
      <div className="px-6 py-3 border-t border-outlineVariant/30 flex items-center justify-between flex-wrap gap-2">
        <span className="text-labelSm text-inkMuted flex items-center gap-1.5">
          <Icon name="auto_awesome" size={14} className="text-primary" />
          {i18nAr.ar.enrichment.aiPowered}
        </span>
        <span className="pill bg-primary/10 text-primary border border-primary/20">
          {i18nAr.ar.enrichment.verified}
        </span>
      </div>
    </motion.div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5 border-t border-outlineVariant/30">
      <h4 className="text-labelSm uppercase tracking-wider text-inkSoft mb-3">{title}</h4>
      {children}
    </div>
  )
}
