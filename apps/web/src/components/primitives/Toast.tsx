import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn.js'

export interface ToastState {
  id: number
  message: string
  tone?: 'info' | 'success' | 'error'
}

let toastSeq = 0
const listeners: Array<(t: ToastState) => void> = []

export function showToast(message: string, tone: ToastState['tone'] = 'info') {
  const t: ToastState = { id: ++toastSeq, message, tone }
  for (const l of listeners) l(t)
}

export function ToastHost() {
  const [items, setItems] = useState<ToastState[]>([])
  useEffect(() => {
    const handler = (t: ToastState) => {
      setItems((cur) => [...cur, t])
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 2800)
    }
    listeners.push(handler)
    return () => {
      const i = listeners.indexOf(handler)
      if (i >= 0) listeners.splice(i, 1)
    }
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-6 inset-x-0 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'pointer-events-auto px-4 py-3 text-sm shadow-card max-w-md text-center',
              t.tone === 'success'
                ? 'border-success/40 text-success'
                : t.tone === 'error'
                  ? 'border-danger/40 text-danger'
                  : 'text-ink'
            )}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
