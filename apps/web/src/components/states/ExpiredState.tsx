import { useState } from 'react'
import { useLocation } from 'wouter'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { Card } from '../primitives/Card.js'
import { Button } from '../primitives/Button.js'
import { MockLookupService } from '../../data/mock-lookup.js'

export function ExpiredState({ lookupId }: { lookupId: string }) {
  const [_, setLocation] = useLocation()
  const [reRunning, setReRunning] = useState(false)

  async function onRerun() {
    setReRunning(true)
    const created = MockLookupService.createLookup()
    setLocation(`/lookups/${created.id}/progress`)
  }

  return (
    <div className="max-w-xl mx-auto pt-8">
      <Card variant="glass" className="text-center py-10">
        <Icon name="schedule" size={48} className="text-inkMuted mb-4" />
        <h2 className="text-headlineMd text-ink">{i18nAr.ar.states.expired.title}</h2>
        <p className="mt-2 text-bodyMd text-inkSoft">{i18nAr.ar.states.expired.body}</p>
        <div className="mt-6 flex justify-center">
          <Button onClick={onRerun} loading={reRunning}>
            {i18nAr.ar.states.expired.cta}
          </Button>
        </div>
      </Card>
    </div>
  )
}
