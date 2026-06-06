import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { cn } from '../../lib/cn.js'
import { Button } from './Button.js'

export type PlanTier = 'free' | 'pro' | 'business'

const TIERS: PlanTier[] = ['free', 'pro', 'business']

export function PlansGrid({
  current,
  onPick,
  compact = false,
}: {
  current?: PlanTier | null
  onPick?: (t: PlanTier) => void
  compact?: boolean
}) {
  const [, setLocation] = useLocation()
  const labels = i18nAr.ar.plans

  return (
    <div
      className={cn(
        'grid gap-6',
        compact ? 'md:grid-cols-3' : 'md:grid-cols-3 max-w-5xl mx-auto'
      )}
    >
      {TIERS.map((t, i) => {
        const plan = labels[t]
        const isPopular = t === 'pro'
        const isCurrent = current === t
        return (
          <motion.div
            key={t}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative rounded-3xl p-7 flex flex-col',
              isPopular
                ? 'glass-card-strong ai-glow border-primary/40'
                : 'glass-card border-outlineVariant/30'
            )}
          >
            {isPopular ? (
              <span className="absolute -top-3 right-6 pill bg-primary text-onPrimary border-0 shadow-lg shadow-primary/30">
                <Icon name="star" fill size={14} />
                {labels.popular}
              </span>
            ) : null}

            <div className="mb-5">
              <div className="text-headlineMd font-bold text-ink">{plan.name}</div>
              <div className="text-labelMd text-inkMuted mt-1">{plan.tagline}</div>
            </div>

            <div className="mb-6 flex items-baseline gap-1.5">
              <span
                className={cn(
                  'text-displayMobile md:text-displayLg font-bold leading-none',
                  isPopular ? 'accent-gradient-text' : 'text-ink'
                )}
                dir="ltr"
              >
                {plan.price === 0 ? '٠' : plan.price}
              </span>
              <span className="text-bodyMd text-inkSoft">
                {plan.price === 0 ? '' : labels.currency}
              </span>
              {plan.price > 0 ? (
                <span className="text-labelSm text-inkMuted ms-1">{labels.period}</span>
              ) : null}
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-bodyMd text-ink/90">
                  <span
                    className={cn(
                      'mt-0.5 size-5 rounded-full flex items-center justify-center shrink-0',
                      isPopular
                        ? 'bg-primary/20 text-primary border border-primary/40'
                        : 'bg-surfaceContainer text-inkSoft border border-outlineVariant/30'
                    )}
                  >
                    <Icon name="check" size={14} fill />
                  </span>
                  <span className="leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={isPopular ? 'primary' : 'outline'}
              size="lg"
              disabled={isCurrent}
              onClick={() => {
                if (onPick) return onPick(t)
                setLocation(t === 'free' ? '/sign-in' : `/sign-in?next=%2Fplans%3Fpick%3D${t}`)
              }}
              className="w-full"
            >
              {isCurrent ? labels.ctaCurrent : labels.cta}
              {!isCurrent ? <Icon name="arrow_back" size={18} /> : null}
            </Button>
          </motion.div>
        )
      })}
    </div>
  )
}
