import { Link } from 'wouter'
import { i18nAr } from '@basmat/shared'

/** Designed "غير مصرح" state for non-owners hitting /admin (FR-008). */
export function NotAuthorisedPage() {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="glass-card p-8 rounded-2xl">
        <h1 className="text-headlineLg font-bold text-warning mb-3">
          {i18nAr.ar.notAuthorised.title}
        </h1>
        <p className="text-bodyMd text-inkSoft mb-6">{i18nAr.ar.notAuthorised.body}</p>
        <Link href="/" className="text-primary hover:opacity-80 underline">
          {i18nAr.ar.notAuthorised.cta}
        </Link>
      </div>
    </div>
  )
}
