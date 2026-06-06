import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { CategoryBlock } from '@basmat/shared'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { cn } from '../../lib/cn.js'
import { Button } from '../primitives/Button.js'
import { FindingCard } from './FindingCard.js'

const CONFIDENCE_BADGE = {
  high: { label: 'عالية', cls: 'bg-primary text-onPrimary' },
  medium: { label: 'متوسطة', cls: 'bg-warning/80 text-background' },
  low: { label: 'منخفضة', cls: 'bg-surfaceVariant text-inkSoft' },
} as const

export function CategorySection({
  block,
  icon = 'category',
}: {
  block: CategoryBlock
  icon?: string
}) {
  const isFailed = block.state === 'failed'
  const isSkipped = block.state === 'skipped'
  const confidence = highestConfidence(block)
  const badge = CONFIDENCE_BADGE[confidence]
  const [open, setOpen] = useState(false)

  const visibleFindings = block.findings.slice(0, 3)
  const hiddenCount = Math.max(0, block.findings.length - visibleFindings.length)

  return (
    <>
      <motion.section
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-surfaceContainer rounded-3xl p-5 border border-outlineVariant/30 flex flex-col justify-between hover:border-primary/50 transition-all group min-h-[200px]"
      >
        <div>
          <header className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <Icon
                name={icon}
                className="text-inkMuted group-hover:text-primary transition-colors"
                size={24}
              />
              <h4 className="text-headlineMd text-ink">{block.displayLabelAr}</h4>
            </div>
            <span className={cn('px-2 py-0.5 rounded-lg text-labelSm', badge.cls)}>
              {badge.label}
            </span>
          </header>

          {isFailed ? (
            <p className="text-bodyMd text-danger/90">{i18nAr.ar.states.degraded.body}</p>
          ) : isSkipped ? (
            <p className="text-bodyMd text-inkMuted italic opacity-70">
              هذه الفئة غير متاحة لنوع المعرّف الحالي.
            </p>
          ) : block.findings.length === 0 ? (
            <p className="text-bodyMd text-inkMuted italic opacity-70">
              لم يتم العثور على نتائج في هذه الفئة.
            </p>
          ) : (
            <ul className="space-y-3">
              {visibleFindings.map((f) => (
                <FindingCard key={f.id} finding={f} compact />
              ))}
            </ul>
          )}
        </div>

        {block.findings.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-6 w-full rounded-lg"
            onClick={() => setOpen(true)}
          >
            عرض التفاصيل
            {hiddenCount > 0 && <span className="text-labelSm">({block.findings.length})</span>}
            <Icon name="chevron_left" size={16} />
          </Button>
        ) : null}
      </motion.section>

      <AnimatePresence>
        {open && (
          <CategoryDetailsModal
            block={block}
            icon={icon}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function CategoryDetailsModal({
  block,
  icon,
  onClose,
}: {
  block: CategoryBlock
  icon: string
  onClose: () => void
}) {
  // Group findings by source so the user sees clearly which tool produced what.
  const groups = groupBySource(block.findings)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cat-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card-strong rounded-3xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[88vh]"
      >
        <header className="flex items-center justify-between px-6 py-5 border-b border-outlineVariant/20 bg-surfaceContainer/60">
          <div className="flex items-center gap-3">
            <Icon name={icon} className="text-primary" size={26} />
            <div>
              <h3 id="cat-modal-title" className="text-headlineMd text-ink font-bold">
                {block.displayLabelAr}
              </h3>
              <p className="text-labelMd text-inkMuted">
                {block.findings.length} نتيجة من {groups.length} مصدر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-full hover:bg-surfaceContainerHigh transition-colors"
          >
            <Icon name="close" size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {groups.map((g) => (
            <section key={g.source} aria-labelledby={`src-${g.source}`}>
              <h4
                id={`src-${g.source}`}
                className="flex items-center gap-2 text-labelMd text-inkSoft mb-3 uppercase tracking-wide font-latin"
              >
                <Icon name="source" size={16} className="text-primary" />
                <span className="text-primary">{g.source}</span>
                <span className="text-inkMuted">· {g.items.length}</span>
              </h4>
              <ul className="space-y-3">
                {g.items.map((f) => (
                  <FindingCard key={f.id} finding={f} compact={false} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="px-6 py-4 border-t border-outlineVariant/20 bg-surfaceContainer/40 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            <Icon name="close" size={16} />
            إغلاق
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

function groupBySource(findings: CategoryBlock['findings']) {
  const map = new Map<string, CategoryBlock['findings']>()
  for (const f of findings) {
    const arr = map.get(f.sourceName) ?? []
    arr.push(f)
    map.set(f.sourceName, arr)
  }
  return Array.from(map.entries())
    .map(([source, items]) => ({ source, items }))
    .sort((a, b) => b.items.length - a.items.length)
}

function highestConfidence(block: CategoryBlock): 'high' | 'medium' | 'low' {
  if (block.findings.length === 0) return 'low'
  const ranks = { high: 3, medium: 2, low: 1 } as const
  let best: 'high' | 'medium' | 'low' = 'low'
  for (const f of block.findings) {
    if (ranks[f.confidence] > ranks[best]) best = f.confidence
  }
  return best
}
