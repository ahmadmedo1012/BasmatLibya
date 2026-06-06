import { useLocation } from 'wouter'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../lib/icon.js'
import { Card } from '../components/primitives/Card.js'
import { Button } from '../components/primitives/Button.js'

export function NotFoundPage() {
  const [_, setLocation] = useLocation()
  return (
    <div className="max-w-xl mx-auto pt-12">
      <Card variant="glass" className="text-center py-10">
        <Icon name="link_off" size={48} className="text-inkMuted mb-4" />
        <h2 className="text-headlineMd text-ink">{i18nAr.ar.states.notFound.title}</h2>
        <p className="mt-2 text-bodyMd text-inkSoft">{i18nAr.ar.states.notFound.body}</p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => setLocation('/')}>{i18nAr.ar.states.notFound.cta}</Button>
        </div>
      </Card>
    </div>
  )
}
