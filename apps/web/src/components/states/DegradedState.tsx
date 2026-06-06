import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { Card } from '../primitives/Card.js'

export function DegradedState() {
  return (
    <Card variant="glass" className="border-warning/30 bg-warning/5 flex items-start gap-3 p-4">
      <Icon name="warning" className="text-warning shrink-0 mt-0.5" size={20} />
      <div>
        <h2 className="text-bodyMd font-semibold text-warning">
          {i18nAr.ar.states.degraded.title}
        </h2>
        <p className="mt-1 text-bodyMd text-ink/90">{i18nAr.ar.states.degraded.body}</p>
      </div>
    </Card>
  )
}
