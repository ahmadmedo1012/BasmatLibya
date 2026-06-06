import { i18nAr } from '@basmat/shared'

/** Designed Arabic state for a suspended user (FR-018, US1 acceptance edge). */
export function SuspendedPage() {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="glass-card p-8 rounded-2xl">
        <h1 className="text-headlineLg font-bold text-danger mb-3">
          {i18nAr.ar.account.suspended.title}
        </h1>
        <p className="text-bodyMd text-inkSoft">{i18nAr.ar.account.suspended.body}</p>
      </div>
    </div>
  )
}
