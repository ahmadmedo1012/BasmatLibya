import { Link } from 'wouter'
import { i18nAr } from '@basmat/shared'

export function HistoryPage() {
  return <HistoryEmpty />
}

function HistoryEmpty() {
  const labels = i18nAr.ar.history.empty
  return (
    <div className="max-w-md mx-auto py-12 text-center">
      <div className="glass-card p-8 rounded-2xl">
        <h2 className="text-headlineMd font-bold text-ink mb-3">{labels.title}</h2>
        <p className="text-bodyMd text-inkSoft mb-6">{labels.body}</p>
        <Link href="/" className="btn-red-gradient text-onPrimary px-5 py-2 rounded-lg font-semibold inline-block">
          {labels.cta}
        </Link>
      </div>
    </div>
  )
}
