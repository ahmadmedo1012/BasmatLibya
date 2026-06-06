import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { Card } from '../primitives/Card.js'
import { Button } from '../primitives/Button.js'

export function FullFailureState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card variant="glass" className="text-center py-10">
      <Icon name="error" size={48} className="text-danger mb-4" />
      <h2 className="text-headlineMd text-ink">{i18nAr.ar.states.fullFailure.title}</h2>
      <p className="mt-2 text-bodyMd text-inkSoft">{i18nAr.ar.states.fullFailure.body}</p>
      <div className="mt-6 flex justify-center">
        <Button variant="secondary" onClick={onRetry}>
          {i18nAr.ar.states.fullFailure.cta}
        </Button>
      </div>
    </Card>
  )
}
