import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../lib/icon.js'
import { attachTelegramWidget, submitTelegramPayload, AuthError } from '../lib/auth.js'

const PERKS = [
  { icon: 'all_inclusive', label: 'بحث غير محدود مع باقتك' },
  { icon: 'auto_awesome', label: 'تحليل ذكي معمّق' },
  { icon: 'history', label: 'سجل دائم لكل بحوثك' },
  { icon: 'shield_lock', label: 'تسجيل آمن بضغطة واحدة' },
] as const

export function SignInPage() {
  const widgetRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setLocation] = useLocation()
  const qc = useQueryClient()
  const botUsername = ((window as unknown as Record<string, string>).__TG_BOT_USERNAME__ ?? import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim()

  useEffect(() => {
    if (!widgetRef.current || !botUsername) return
    const detach = attachTelegramWidget({
      el: widgetRef.current,
      botUsername,
      onPayload: async (payload) => {
        try {
          await submitTelegramPayload(payload)
          await qc.invalidateQueries({ queryKey: ['auth', 'me'] })
          const next = new URLSearchParams(window.location.search).get('next') || '/'
          setLocation(next)
        } catch (err) {
          if (err instanceof AuthError) {
            const map = i18nAr.ar.errors as Record<string, string>
            setError(map[err.code] ?? i18nAr.ar.signIn.failure.body)
          } else {
            setError(i18nAr.ar.signIn.failure.body)
          }
        }
      },
    })
    return () => detach()
  }, [botUsername, qc, setLocation])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-lg mx-auto py-6 md:py-10"
    >
      <div className="glass-card-strong ai-glow rounded-[32px] p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative text-center">
          <div className="size-16 mx-auto mb-5 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
            <Icon name="fingerprint" size={36} fill />
          </div>
          <span className="pill bg-primary/10 text-primary border border-primary/30 mb-3">
            <Icon name="lock_open" size={14} fill />
            خطوة واحدة فقط
          </span>
          <h1 className="text-headlineLg md:text-displayMobile font-bold text-ink mb-3 leading-tight">
            {i18nAr.ar.signIn.heading}
          </h1>
          <p className="text-bodyLg text-inkSoft max-w-sm mx-auto leading-relaxed">
            {i18nAr.ar.signIn.subheading}
          </p>
        </div>

        <div className="relative mt-8 flex justify-center">
          {!botUsername ? (
            <div className="glass-card p-6 rounded-2xl text-bodyMd text-inkMuted text-center max-w-md">
              سيتم تفعيل تسجيل الدخول عبر تليجرام بعد ضبط <code className="font-latin">VITE_TELEGRAM_BOT_USERNAME</code>
              {' '}في إعدادات البيئة.
            </div>
          ) : (
            <div ref={widgetRef} className="min-h-[60px] flex items-center justify-center" aria-label={i18nAr.ar.signIn.telegramAction} />
          )}
        </div>

        {error && (
          <div role="alert" className="relative mt-6 glass-card p-4 rounded-2xl text-bodyMd text-danger border-danger/30">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <Icon name="error" size={18} />
              {i18nAr.ar.signIn.failure.title}
            </div>
            <div>{error}</div>
          </div>
        )}

        <div className="relative mt-8 pt-6 border-t border-outlineVariant/30 grid grid-cols-2 gap-3">
          {PERKS.map((p) => (
            <div key={p.label} className="flex items-start gap-2.5 text-labelMd text-inkSoft">
              <span className="size-7 shrink-0 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <Icon name={p.icon} size={16} fill />
              </span>
              <span className="leading-snug">{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
