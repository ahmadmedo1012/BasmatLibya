import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn.js'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'btn-red-gradient text-onPrimary hover:shadow-glowStrong active:scale-[0.98] disabled:opacity-50 disabled:shadow-none',
  secondary:
    'bg-surfaceContainer text-ink border border-outlineVariant hover:bg-surfaceBright hover:border-primary/50 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none',
  outline:
    'bg-transparent text-ink border border-outlineVariant hover:bg-surfaceBright hover:border-primary/50 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none',
  ghost: 'bg-transparent text-inkSoft hover:bg-surfaceContainer hover:text-primary active:scale-[0.98] disabled:opacity-50',
  danger:
    'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-[14px]',
  lg: 'h-14 px-8 text-[16px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, disabled, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold select-none',
        'transition-all duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span className="inline-block size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      ) : null}
      {children}
    </button>
  )
})
