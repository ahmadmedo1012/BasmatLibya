import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'wouter'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { Button } from './Button.js'
import { PlansGrid } from './PlansGrid.js'

export function PaywallModal({
  open,
  onClose,
  reason = 'exhausted',
}: {
  open: boolean
  onClose: () => void
  reason?: 'exhausted' | 'last-try'
}) {
  const [, setLocation] = useLocation()
  const labels = i18nAr.ar.paywall

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="paywall"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 overflow-y-auto"
          aria-modal="true"
          role="dialog"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-background/85 backdrop-blur-2xl" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative glass-card-strong ai-glow rounded-[32px] p-7 md:p-12 max-w-4xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="absolute top-5 left-5 size-9 rounded-full bg-surfaceContainer/60 hover:bg-surfaceContainer text-inkSoft hover:text-ink flex items-center justify-center transition-colors"
            >
              <Icon name="close" size={18} />
            </button>

            <div className="relative text-center mb-8">
              <span className="pill bg-primary/15 text-primary border border-primary/30 mb-4">
                <Icon name="lock" fill size={14} />
                {labels.eyebrow}
              </span>
              <h2 className="text-displayMobile md:text-displayLg font-bold text-ink mt-3 mb-3 leading-tight">
                {labels.title}
              </h2>
              <p className="text-bodyLg text-inkSoft max-w-2xl mx-auto leading-relaxed">
                {labels.body}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => setLocation('/sign-in?next=%2Fplans')}
                >
                  <Icon name="rocket_launch" size={18} fill />
                  {labels.primary}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setLocation('/plans')}
                >
                  {labels.secondary}
                </Button>
              </div>
              <p className="text-labelSm text-inkMuted mt-3">{labels.afterAuth}</p>
            </div>

            <div className="relative">
              <PlansGrid compact />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
