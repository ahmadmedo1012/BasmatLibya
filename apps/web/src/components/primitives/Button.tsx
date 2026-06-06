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
    'btn-red-gradient text-onPrimary font-bold hover:shadow-glowStrong active:scale-[0.97] disabled:opacity-40 disabled:shadow-none shadow-[0_4px_20px_-6px_rgba(229,62,62,0.4)]',
  secondary:
    'bg-surfaceContainer text-ink border border-outlineVariant/50 hover:bg-surfaceBright hover:border-primary/40 active:scale-[0.97] disabled:opacity-40 font-semibold',
  outline:
    'bg-transparent text-ink border-2 border-outlineVariant/50 hover:bg-surfaceContainer hover:border-primary/40 active:scale-[0.97] disabled:opacity-40 font-semibold',
  ghost: 'bg-transparent text-inkSoft hover:bg-surfaceContainer hover:text-primary active:scale-[0.97] disabled:opacity-40 font-medium',
  danger:
    'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 active:scale-[0.97] disabled:opacity-40 font-semibold',
}

const sizes: Record<Size, string> = {
  sm: 'h-10 px-4 text-labelMd',
  md: 'h-12 px-6 text-bodyMd',
  lg: 'h-14 px-8 text-bodyLg',
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
        'inline-flex items-center justify-center gap-2.5 rounded-2xl select-none',
        'transition-all duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span className="inline-block size-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      ) : null}
      {children}
    </button>
  )
})
