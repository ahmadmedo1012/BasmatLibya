import { useState, useMemo } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import {
  detectIdentifierType,
  IdentifierValueSchema,
  i18nAr,
  type IdentifierType,
} from '@basmat/shared'
import { Button } from '../components/primitives/Button.js'
import { Input } from '../components/primitives/Input.js'
import { PaywallModal } from '../components/primitives/PaywallModal.js'
import { Icon } from '../lib/icon.js'
import { cn } from '../lib/cn.js'
import { useTrialState } from '../lib/queries.js'
import { MockLookupService } from '../data/mock-lookup.js'
import { showToast } from '../components/primitives/Toast.js'

const TYPE_LABEL_AR: Record<IdentifierType, string> = {
  name: 'اسم',
  username: 'اسم مستخدم',
  email: 'بريد إلكتروني',
  phone: 'رقم هاتف',
}

const EXAMPLES = ['محمد علي', '091XXXXXXX', 'name@domain.ly']

const FEATURES = [
  {
    icon: 'psychology',
    title: 'تحليل ذكي',
    body: 'خوارزميات متقدمة تربط النقاط بين البيانات المبعثرة لبناء ملف تعريف دقيق وشامل.',
  },
  {
    icon: 'bolt',
    title: 'نتائج فورية',
    body: 'ابدأ بحثك وشاهد النتائج تتدفق لحظة بلحظة. لا انتظار، لا تعقيد.',
  },
  {
    icon: 'verified_user',
    title: 'مصادر عامة فقط',
    body: 'نعتمد على البيانات المفتوحة والمتاحة للجميع، مع احترام الخصوصية والأخلاقيات.',
  },
] as const

export function HomePage() {
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [_loc, setLocation] = useLocation()
  const trial = useTrialState()
  const remaining = trial.data?.remaining ?? 3
  const exhausted = trial.data?.exhausted ?? false

  const trimmed = value.trim()
  const detected: IdentifierType | null = trimmed.length >= 2 ? detectIdentifierType(trimmed) : null
  const validationError = useMemo(() => {
    if (!touched) return null
    const r = IdentifierValueSchema.safeParse(value)
    if (!r.success) {
      const code = r.error.issues[0]?.message ?? 'identifier_invalid'
      return (i18nAr.ar.validation as Record<string, string>)[code] ?? i18nAr.ar.errors.generic
    }
    return null
  }, [value, touched])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    const r = IdentifierValueSchema.safeParse(value)
    if (!r.success) return
    if (exhausted) {
      setPaywallOpen(true)
      return
    }
    setSubmitting(true)
    try {
      const created = MockLookupService.createLookup()
      setLocation(`/lookups/${created.id}/progress`)
    } catch {
      showToast(i18nAr.ar.errors.generic, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function fillExample(example: string) {
    setValue(example)
    setTouched(false)
  }

  return (
    <>
      <section className="max-w-[820px] mx-auto text-center mb-12 md:mb-16 animate-fadeIn relative">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 mb-7 pill bg-primary/10 text-primary border border-primary/30"
        >
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          منصّة الذكاء الرقمي العربية الأولى
        </motion.div>
        <h1 className="text-displayMobile md:text-displayLg mb-6 leading-[1.05] font-bold">
          <span className="text-ink">من تريد أن </span>
          <span className="accent-gradient-text-strong">تبحث عنه</span>
          <span className="text-ink">؟</span>
        </h1>
        <p className="text-bodyLg text-inkSoft max-w-2xl mx-auto leading-relaxed">
          ذكاء اصطناعي يحلّل الهوية الرقمية لأي شخص عبر اسم أو بريد أو رقم هاتف،
          من المصادر العامة فقط، خلال ثوانٍ.
        </p>

        {remaining !== null ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="mt-6 inline-flex items-center gap-2 text-labelMd text-inkSoft"
          >
            <span className="flex items-center gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'size-2.5 rounded-full transition-all',
                    i < remaining ? 'bg-primary shadow-[0_0_8px_theme(colors.primary)]' : 'bg-outlineVariant/40'
                  )}
                />
              ))}
            </span>
            {exhausted ? (
              <button
                type="button"
                onClick={() => setPaywallOpen(true)}
                className="text-primary underline-offset-4 hover:underline"
              >
                {i18nAr.ar.errors.free_trial_exhausted}
              </button>
            ) : (
              <span>
                {remaining === 1
                  ? i18nAr.ar.paywall.lastTry
                  : i18nAr.ar.paywall.triesLeft.replace('{{count}}', String(remaining))}
              </span>
            )}
          </motion.div>
        ) : null}
      </section>

      <section className="max-w-[760px] mx-auto mb-16 md:mb-24 relative">
        <div className="absolute inset-0 -z-[1] blur-3xl opacity-60 pointer-events-none">
          <div className="absolute inset-x-12 inset-y-0 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 rounded-full" />
        </div>
        <form onSubmit={onSubmit} className="relative group">
          <div
            className={cn(
              'glass-card-strong search-glow rounded-[28px] p-2.5 flex flex-col md:flex-row items-stretch md:items-center gap-2 transition-all duration-300 shadow-[0_30px_80px_-30px_rgba(229,90,90,0.4)]',
              validationError && 'border-danger/50'
            )}
          >
            <div className="flex flex-1 items-center px-4 w-full">
              <Icon name="search" className="text-primary me-3" size={22} />
              <Input
                autoFocus
                dir="auto"
                placeholder="أدخل اسماً، بريداً، أو رقماً..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => setTouched(true)}
                invalid={Boolean(validationError)}
                aria-label="مدخل البحث"
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? 'identifier-error' : undefined}
                className="py-5 text-bodyLg"
              />
              {detected && !validationError ? (
                <motion.span
                  key={detected}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="pill bg-primary/15 text-primary border border-primary/30 me-2 shrink-0"
                >
                  {TYPE_LABEL_AR[detected]}
                </motion.span>
              ) : null}
            </div>
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              disabled={!value.trim() || Boolean(validationError)}
              className="w-full md:w-auto rounded-2xl px-8"
            >
              <span>{submitting ? i18nAr.ar.home.submitting : i18nAr.ar.home.submit}</span>
              <Icon name="bolt" fill size={20} />
            </Button>
          </div>

          {validationError ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              id="identifier-error"
              className="mt-3 text-sm text-danger px-4"
            >
              {validationError}
            </motion.p>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <span className="text-labelSm text-inkMuted self-center">جرّب:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => fillExample(ex)}
                className="text-labelSm text-inkSoft bg-surfaceContainer/60 backdrop-blur px-3.5 py-1.5 rounded-full border border-outlineVariant/40 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
      </section>

      <section className="max-w-maxWidth mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            className="glass-card p-8 rounded-3xl group hover:border-primary/50 transition-all relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/15 transition-colors pointer-events-none" />
            <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary border border-primary/20 group-hover:scale-110 group-hover:bg-primary/20 transition-transform">
              <Icon name={f.icon} size={28} fill />
            </div>
            <h3 className="text-headlineMd text-ink mb-3 font-bold">{f.title}</h3>
            <p className="text-bodyMd text-inkSoft leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </section>

      {!exhausted ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto mt-20 glass-card-strong ai-glow rounded-[28px] p-8 md:p-12 text-center relative overflow-hidden"
        >
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
          <span className="pill bg-primary/15 text-primary border border-primary/30 mb-4">
            <Icon name="diamond" fill size={14} />
            انضم إلى المنصة
          </span>
          <h3 className="text-headlineLg md:text-displayMobile font-bold text-ink mt-2 mb-4 leading-tight relative">
            تجربتك المجانية تنتهي بسرعة، الباقات لا
          </h3>
          <p className="text-bodyLg text-inkSoft max-w-xl mx-auto mb-7 relative">
            سجّل الدخول عبر تليجرام بنقرة واحدة، واختر باقة تفتح لك الذكاء الكامل.
          </p>
          <div className="flex flex-wrap justify-center gap-3 relative">
            <Button size="lg" variant="primary" onClick={() => setLocation('/sign-in?next=%2Fplans')}>
              <Icon name="rocket_launch" fill size={18} />
              {i18nAr.ar.paywall.primary}
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation('/plans')}>
              {i18nAr.ar.paywall.secondary}
            </Button>
          </div>
        </motion.section>
      ) : null}

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  )
}
