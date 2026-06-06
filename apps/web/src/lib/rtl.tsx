import { type ReactNode } from 'react'
import { cn } from './cn.js'

/**
 * Wrap source-native content (e.g. Latin usernames inside Arabic chrome) so
 * the browser's bidi algorithm doesn't bleed punctuation across the boundary.
 */
export function BidiIsolate({
  children,
  lang,
  className,
}: {
  children: ReactNode
  lang?: string | null
  className?: string
}) {
  const dir = lang && /^(en|fr|de|it|pt|es|nl|ru|tr)/i.test(lang) ? 'ltr' : undefined
  return (
    <span className={cn('bidi-isolate', className)} dir={dir} lang={lang ?? undefined}>
      {children}
    </span>
  )
}
