import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { CategoryBlock } from '@basmat/shared'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { cn } from '../../lib/cn.js'
import { Button } from '../primitives/Button.js'
import { FindingCard } from './FindingCard.js'

const CONFIDENCE_BADGE = {
  high: { label: 'ثقة عالية', cls: 'bg-primary/20 text-primary border border-primary/30' },
  medium: { label: 'ثقة متوسطة', cls: 'bg-warning/15 text-warning border border-warning/30' },
  low: { label: 'ثقة منخفضة', cls: 'bg-surfaceVariant text-inkSoft border border-outlineVariant/30' },
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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-card rounded-3xl p-6 flex flex-col justify-between hover:border-primary/40 transition-all group min-h-[220px]"
      >
        <div>
          <header className="flex justify-between items-start mb-5">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                <Icon name={icon} size={24} />
              </div>
              <h4 className="text-headlineMd text-ink font-extrabold">{block.displayLabelAr}</h4>
            </div>
            <span className={cn('px-2.5 py-1 rounded-lg text-labelSm font-bold', badge.cls)}>
              {badge.label}
            </span>
          </header>

          {isFailed ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-danger/10 border border-danger/20">
              <Icon name="error" className="text-danger shrink-0" size={22} />
              <p className="text-bodyMd text-danger font-semibold">{i18nAr.ar.states.degraded.body}</p>
            </div>
          ) : isSkipped ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-surfaceContainer border border-outlineVariant/20">
              <Icon name="block" className="text-inkMuted shrink-0" size={22} />
              <p className="text-bodyMd text-inkMuted font-medium">
                هذه الفئة غير متاحة لنوع المعرّف الحالي.
              </p>
            </div>
          ) : block.findings.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-surfaceContainer border border-outlineVariant/20">
              <Icon name="search_off" className="text-inkMuted shrink-0" size={22} />
              <p className="text-bodyMd text-inkMuted font-medium">
                لم يتم العثور على نتائج في هذه الفئة.
              </p>
            </div>
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
            className="mt-6 w-full rounded-xl font-bold"
            onClick={() => setOpen(true)}
          >
            عرض التفاصيل
            {hiddenCount > 0 && <span className="text-labelSm text-primary"> ({block.findings.length})</span>}
            <Icon name="chevron_left" size={18} />
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
  const groups = groupBySource(block.findings)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cat-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card-strong rounded-3xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[88vh]"
      >
        <header className="flex items-center justify-between px-6 py-5 border-b border-outlineVariant/20 bg-surfaceContainer/60">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary">
              <Icon name={icon} size={26} />
            </div>
            <div>
              <h3 id="cat-modal-title" className="text-headlineMd text-ink font-extrabold">
                {block.displayLabelAr}
              </h3>
              <p className="text-labelMd text-inkMuted font-medium">
                {block.findings.length} نتيجة من {groups.length} مصدر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="size-10 rounded-xl hover:bg-surfaceContainerHigh transition-colors flex items-center justify-center"
          >
            <Icon name="close" size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {groups.map((g) => (
            <section key={g.source} aria-labelledby={`src-${g.source}`}>
              <h4
                id={`src-${g.source}`}
                className="flex items-center gap-2 text-labelMd text-primary mb-4 font-bold"
              >
                <Icon name="source" size={18} fill />
                <span>{g.source}</span>
                <span className="text-inkMuted font-medium">· {g.items.length}</span>
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
          <Button variant="outline" size="sm" onClick={onClose} className="font-bold">
            <Icon name="close" size={18} />
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
