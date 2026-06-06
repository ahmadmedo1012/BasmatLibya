import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../lib/icon.js'

const PERKS = [
  { icon: 'all_inclusive', label: 'بحث غير محدود مع باقتك' },
  { icon: 'auto_awesome', label: 'تحليل ذكي معمّق' },
  { icon: 'history', label: 'سجل دائم لكل بحوثك' },
  { icon: 'shield_lock', label: 'تسجيل آمن بضغطة واحدة' },
] as const

export function SignInPage() {
  const [, setLocation] = useLocation()

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
          <div className="glass-card p-6 rounded-2xl text-bodyMd text-inkMuted text-center max-w-md">
            تسجيل الدخول عبر تليجرام غير متاح في وضع التطوير الثابت.
          </div>
        </div>

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

        <div className="relative mt-8 text-center">
          <button
            type="button"
            onClick={() => setLocation('/')}
            className="text-labelMd text-primary hover:opacity-80"
          >
            العودة إلى الصفحة الرئيسية
          </button>
        </div>
      </div>
    </motion.div>
  )
}
