import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { Card } from '../primitives/Card.js'
import { Button } from '../primitives/Button.js'

export function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card variant="glass" className="text-center py-10">
      <Icon name="search_off" size={48} className="text-inkMuted mb-4" />
      <h2 className="text-headlineMd text-ink">{i18nAr.ar.states.empty.title}</h2>
      <p className="mt-2 text-bodyMd text-inkSoft">{i18nAr.ar.states.empty.body}</p>
      <div className="mt-6 flex justify-center">
        <Button onClick={onRetry}>{i18nAr.ar.states.empty.cta}</Button>
      </div>
    </Card>
  )
}
