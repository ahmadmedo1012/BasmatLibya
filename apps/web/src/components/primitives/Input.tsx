import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn.js'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full bg-transparent border-none focus:ring-0 focus:outline-none text-ink',
        'placeholder:text-inkMuted/50 placeholder:font-normal',
        'text-bodyMd font-medium',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        invalid && 'text-danger placeholder:text-danger/40',
        className
      )}
      {...rest}
    />
  )
})
