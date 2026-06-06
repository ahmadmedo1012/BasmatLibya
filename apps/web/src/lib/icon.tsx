import { type HTMLAttributes } from 'react'
import { cn } from './cn.js'

interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: string
  fill?: boolean
  size?: number
}

/**
 * Material Symbols Outlined icon. The font is loaded via fonts.css.
 * Pass `fill` to use the filled variant.
 */
export function Icon({ name, fill, size = 24, className, style, ...rest }: IconProps) {
  return (
    <span
      aria-hidden
      className={cn('material-symbols-outlined', fill && 'fill', className)}
      style={{ fontSize: `${size}px`, ...style }}
      {...rest}
    >
      {name}
    </span>
  )
}
