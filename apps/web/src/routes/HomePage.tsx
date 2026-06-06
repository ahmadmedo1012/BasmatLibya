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
import { useCreateLookup, useTrialState } from '../lib/queries.js'
import { ApiError } from '../lib/api.js'
import { showToast } from '../components/primitives/Toast.js'
import { usePrincipal } from '../lib/auth.js'

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
    title: 'تحليل ذكي بالذكاء الاصطناعي',
    body: 'خوارزميات متقدمة تربط النقاط بين البيانات المبعثرة لبناء ملف تعريف دقيق وشامل في ثوانٍ.',
    color: 'from-red-500/20 to-orange-500/10',
    borderColor: 'border-red-500/20',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
  },
  {
    icon: 'bolt',
    title: 'نتائج فورية ومباشرة',
    body: 'ابدأ بحثك وشاهد النتائج تتدفق لحظة بلحظة. لا انتظار، لا تعقيد — فقط نتائج.',
    color: 'from-amber-500/20 to-yellow-500/10',
    borderColor: 'border-amber-500/20',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
  },
  {
    icon: 'verified_user',
    title: 'مصادر عامة وشفافة',
    body: 'نعتمد على البيانات المفتوحة والمتاحة للجميع، مع احترام كامل للخصوصية والأخلاقيات.',
    color: 'from-emerald-500/20 to-green-500/10',
    borderColor: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
] as const

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

export function HomePage() {
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [_loc, setLocation] = useLocation()
  const principal = usePrincipal()
  const create = useCreateLookup()
  const trial = useTrialState()
  const remaining = principal ? null : (trial.data?.remaining ?? 3)
  const exhausted = !principal && (trial.data?.exhausted ?? false)

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
    try {
      const created = await create.mutateAsync({ identifier: r.data })
      setLocation(`/lookups/${created.id}/progress`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.payload.code === 'free_trial_exhausted') {
          setPaywallOpen(true)
          return
        }
        showToast(err.payload.messageAr, 'error')
      } else {
        showToast(i18nAr.ar.errors.generic, 'error')
      }
    }
  }

  function fillExample(example: string) {
    setValue(example)
    setTouched(false)
  }

  return (
    <>
      {/* Hero */}
      <section className="max-w-[900px] mx-auto text-center mb-14 md:mb-20 relative">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2.5 mb-8 pill bg-primary/15 text-primary border border-primary/30 font-semibold"
        >
          <span className="size-2 rounded-full bg-primary animate-pulse" />
          منصّة الذكاء الرقمي العربية الأولى
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-displayMobile md:text-displayLg mb-7 leading-[1.05] font-black"
        >
          <span className="text-ink">من تريد أن </span>
          <span className="accent-gradient-text-strong">تبحث عنه</span>
          <span className="text-ink">؟</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-bodyLg md:text-title text-inkSoft max-w-2xl mx-auto leading-relaxed"
        >
          ذكاء اصطناعي يحلّل الهوية الرقمية لأي شخص عبر اسم أو بريد أو رقم هاتف،
          <br className="hidden md:block" />
          من المصادر العامة فقط، خلال ثوانٍ.
        </motion.p>

        {/* Trial counter — anonymous only */}
        {!principal && remaining !== null ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-8 inline-flex items-center gap-3 text-labelMd text-inkSoft bg-surfaceContainer/50 backdrop-blur px-5 py-2.5 rounded-full border border-outlineVariant/30"
          >
            <span className="flex items-center gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'size-3 rounded-full transition-all',
                    i < remaining
                      ? 'bg-primary shadow-[0_0_10px_rgba(229,62,62,0.6)]'
                      : 'bg-outlineVariant/40'
                  )}
                />
              ))}
            </span>
            {exhausted ? (
              <button
                type="button"
                onClick={() => setPaywallOpen(true)}
                className="text-primary font-semibold underline-offset-4 hover:underline"
              >
                {i18nAr.ar.errors.free_trial_exhausted}
              </button>
            ) : (
              <span className="font-medium">
                {remaining === 1
                  ? i18nAr.ar.paywall.lastTry
                  : i18nAr.ar.paywall.triesLeft.replace('{{count}}', String(remaining))}
              </span>
            )}
          </motion.div>
        ) : null}
      </section>

      {/* Search Bar */}
      <section className="max-w-[820px] mx-auto mb-16 md:mb-24 relative">
        {/* Background glow */}
        <div className="absolute inset-0 -z-[1] blur-3xl opacity-70 pointer-events-none">
          <div className="absolute inset-x-8 inset-y-0 bg-gradient-to-r from-primary/25 via-primary/50 to-primary/25 rounded-full" />
        </div>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={onSubmit}
          className="relative group"
        >
          <div
            className={cn(
              'glass-card-strong search-glow rounded-[32px] p-3 md:p-3.5 flex flex-col md:flex-row items-stretch md:items-center gap-3 transition-all duration-300 shadow-[0_30px_80px_-25px_rgba(229,62,62,0.45)]',
              validationError && 'border-danger/60'
            )}
          >
            <div className="flex flex-1 items-center px-5 w-full">
              <Icon name="search" className="text-primary me-4" size={26} />
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
                className="py-5 text-bodyLg md:text-title font-medium placeholder:text-inkMuted/60"
              />
              {detected && !validationError ? (
                <motion.span
                  key={detected}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="pill bg-primary/20 text-primary border border-primary/40 me-2 shrink-0 font-bold"
                >
                  {TYPE_LABEL_AR[detected]}
                </motion.span>
              ) : null}
            </div>
            <Button
              type="submit"
              size="lg"
              loading={create.isPending}
              disabled={!value.trim() || Boolean(validationError)}
              className="w-full md:w-auto rounded-2xl px-10 py-4 text-title font-bold shadow-[0_8px_30px_-8px_rgba(229,62,62,0.5)] hover:shadow-[0_12px_40px_-10px_rgba(229,62,62,0.6)] transition-shadow"
            >
              <span>{create.isPending ? i18nAr.ar.home.submitting : i18nAr.ar.home.submit}</span>
              <Icon name="bolt" fill size={22} />
            </Button>
          </div>

          {validationError ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              id="identifier-error"
              className="mt-4 text-bodyMd text-danger font-semibold px-5 flex items-center gap-2"
            >
              <Icon name="error" size={18} />
              {validationError}
            </motion.p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <span className="text-labelMd text-inkMuted self-center font-medium">جرّب:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => fillExample(ex)}
                className="text-labelMd text-inkSoft bg-surfaceContainer/70 backdrop-blur px-4 py-2 rounded-full border border-outlineVariant/50 hover:border-primary/50 hover:text-primary hover:bg-primary/10 transition-all font-medium"
              >
                {ex}
              </button>
            ))}
          </div>
        </motion.form>
      </section>

      {/* Features */}
      <section className="max-w-maxWidth mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="contents"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={itemVariants}
              className={cn(
                'glass-card p-8 md:p-10 rounded-3xl group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden border',
                f.borderColor
              )}
            >
              {/* Hover glow */}
              <div className={cn(
                'absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br',
                f.color
              )} />
              <div className={cn(
                'size-14 rounded-2xl flex items-center justify-center mb-6 border transition-transform duration-300 group-hover:scale-110',
                f.iconBg,
                f.iconColor,
                f.borderColor
              )}>
                <Icon name={f.icon} size={30} fill />
              </div>
              <h3 className="text-headlineMd text-ink mb-4 font-extrabold">{f.title}</h3>
              <p className="text-bodyMd text-inkSoft leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Final CTA strip */}
      {!principal ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto mt-20 md:mt-28 glass-card-strong ai-glow rounded-[32px] p-10 md:p-14 text-center relative overflow-hidden"
        >
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-primary/15 rounded-full blur-[120px] pointer-events-none" />
          <div className="relative">
            <span className="pill bg-primary/20 text-primary border border-primary/40 mb-5 font-bold">
              <Icon name="diamond" fill size={16} />
              انضم إلى المنصة
            </span>
            <h3 className="text-headlineLg md:text-displayMobile font-black text-ink mt-3 mb-5 leading-tight">
              تجربتك المجانية تنتهي بسرعة، الباقات لا
            </h3>
            <p className="text-bodyLg text-inkSoft max-w-xl mx-auto mb-8 leading-relaxed">
              سجّل الدخول عبر تليجرام بنقرة واحدة، واختر باقة تفتح لك الذكاء الكامل.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="primary" onClick={() => setLocation('/sign-in?next=%2Fplans')} className="font-bold px-8 py-4 text-title shadow-[0_8px_30px_-8px_rgba(229,62,62,0.5)]">
                <Icon name="rocket_launch" fill size={20} />
                {i18nAr.ar.paywall.primary}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation('/plans')} className="font-bold px-8 py-4 text-title">
                {i18nAr.ar.paywall.secondary}
              </Button>
            </div>
          </div>
        </motion.section>
      ) : null}

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  )
}
