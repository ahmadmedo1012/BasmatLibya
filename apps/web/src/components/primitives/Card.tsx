import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn.js'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'glassStrong' | 'plain'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = 'default', ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-3xl p-5',
        variant === 'default' &&
          'bg-surfaceContainer border border-outlineVariant/30',
        variant === 'glass' && 'glass-card',
        variant === 'glassStrong' && 'glass-card-strong',
        variant === 'plain' && '',
        className
      )}
      {...rest}
    />
  )
})
