import { Link, Route, Switch, useLocation } from 'wouter'
import { i18nAr } from '@basmat/shared'
import { usePrincipal } from '../../lib/auth.js'
import { NotAuthorisedPage } from '../NotAuthorisedPage.js'
import { AiModelsPage } from './AiModelsPage.js'
import { UsersPage } from './UsersPage.js'
import { SiteSettingsPage } from './SiteSettingsPage.js'
import { AuditLogPage } from './AuditLogPage.js'
import { cn } from '../../lib/cn.js'

/**
 * Admin shell — owner-only. Server is authoritative; this is the polish gate
 * so admin chrome never flashes for non-owners (R-10).
 */
export function AdminLayout() {
  const principal = usePrincipal()
  const [location] = useLocation()

  if (!principal) {
    return <NotAuthorisedPage />
  }
  if (principal.role !== 'owner' || principal.status !== 'active') {
    return <NotAuthorisedPage />
  }

  const navItems = [
    { href: '/admin/ai-models', label: i18nAr.ar.admin.sections.aiModels, key: 'ai-models' },
    { href: '/admin/users', label: i18nAr.ar.admin.sections.users, key: 'users' },
    { href: '/admin/site-settings', label: i18nAr.ar.admin.sections.siteSettings, key: 'site-settings' },
    { href: '/admin/audit', label: i18nAr.ar.admin.sections.audit, key: 'audit' },
  ]

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-8 max-w-6xl mx-auto">
      <aside className="md:sticky md:top-24 self-start">
        <h1 className="text-headlineMd font-bold text-ink mb-4">{i18nAr.ar.admin.title}</h1>
        <nav className="flex flex-col gap-1" aria-label="admin">
          {navItems.map((item) => {
            const active = location.startsWith(item.href)
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'px-3 py-2 rounded-lg text-bodyMd transition-colors',
                  active
                    ? 'bg-primarySoft text-primary font-semibold'
                    : 'text-inkSoft hover:bg-surfaceContainerLow'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <section>
        <Switch>
          <Route path="/admin" component={AiModelsPage} />
          <Route path="/admin/ai-models" component={AiModelsPage} />
          <Route path="/admin/users" component={UsersPage} />
          <Route path="/admin/site-settings" component={SiteSettingsPage} />
          <Route path="/admin/audit" component={AuditLogPage} />
        </Switch>
      </section>
    </div>
  )
}
