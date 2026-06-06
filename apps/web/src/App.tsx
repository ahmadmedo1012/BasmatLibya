import { Route, Switch, Link, useLocation } from 'wouter'
import { lazy, Suspense } from 'react'
import { HomePage } from './routes/HomePage.js'
import { ProgressPage } from './routes/ProgressPage.js'
import { ResultPage } from './routes/ResultPage.js'
import { NotFoundPage } from './routes/NotFoundPage.js'
import { SignInPage } from './routes/SignInPage.js'
import { SuspendedPage } from './routes/SuspendedPage.js'
import { NotAuthorisedPage } from './routes/NotAuthorisedPage.js'
import { HistoryPage } from './routes/HistoryPage.js'
import { PlansPage } from './routes/PlansPage.js'
import { ToastHost } from './components/primitives/Toast.js'
import { Icon } from './lib/icon.js'
import { i18nAr } from '@basmat/shared'
import { cn } from './lib/cn.js'
import { usePrincipal, useSignOut } from './lib/auth.js'

// Admin chunk is lazy — never shipped to non-owners (R-15).
const AdminLayout = lazy(() =>
  import('./routes/admin/AdminLayout.js').then((m) => ({ default: m.AdminLayout }))
)

export function App() {
  return (
    <div className="bg-background min-h-screen flex flex-col selection:bg-primary/30 relative">
      <div className="bg-aurora" aria-hidden />
      <TopAppBar />

      <main className="flex-grow pt-20 pb-28 px-marginMobile md:px-marginDesktop bg-grid relative z-[1]">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/plans" component={PlansPage} />
          <Route path="/sign-in" component={SignInPage} />
          <Route path="/suspended" component={SuspendedPage} />
          <Route path="/not-authorised" component={NotAuthorisedPage} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/lookups/:id/progress">
            {(params) => <ProgressPage id={params.id} />}
          </Route>
          <Route path="/lookups/:id">
            {(params) => <ResultPage id={params.id} />}
          </Route>
          <Route path="/admin/:rest*">
            <Suspense fallback={<AdminLoadingState />}>
              <AdminLayout />
            </Suspense>
          </Route>
          <Route component={NotFoundPage} />
        </Switch>
      </main>

      <footer className="bg-surfaceContainerLowest border-t border-outlineVariant/15 w-full py-10 mb-20 flex flex-col items-center gap-5 px-marginMobile text-center">
        <div className="flex items-center gap-2">
          <Icon name="fingerprint" className="text-primary" size={20} />
          <span className="text-headlineMd font-extrabold text-primary">{i18nAr.ar.app.name}</span>
        </div>
        <p className="text-labelMd text-inkMuted">© 2026 Basma Libya Intelligence. جميع الحقوق محفوظة.</p>
      </footer>

      <BottomNavBar />
      <ToastHost />
    </div>
  )
}

function AdminLoadingState() {
  return <div className="text-center text-inkMuted text-bodyMd py-12 font-medium">جاري التحميل…</div>
}

function TopAppBar() {
  const principal = usePrincipal()
  const signOut = useSignOut()
  return (
    <header className="bg-surface/85 backdrop-blur-2xl border-b border-outlineVariant/25 fixed top-0 w-full z-50 flex justify-between items-center px-marginMobile md:px-marginDesktop h-16 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <Link href="/" className="flex items-center gap-2.5 transition-transform active:scale-95 focus-visible:outline-none group">
        <div className="size-9 bg-red-gradient rounded-xl flex items-center justify-center shadow-[0_4px_15px_-4px_rgba(229,62,62,0.4)] group-hover:shadow-[0_6px_20px_-4px_rgba(229,62,62,0.5)] transition-shadow">
          <Icon name="fingerprint" className="text-white" size={20} />
        </div>
        <span className="text-headlineMd font-extrabold text-ink">{i18nAr.ar.app.name}</span>
      </Link>
      <div className="flex items-center gap-3">
        {principal ? (
          <>
            {principal.role === 'owner' && (
              <Link href="/admin" className="text-labelMd text-primary hover:opacity-80 px-3 py-1.5 font-semibold rounded-lg hover:bg-primary/10 transition-colors">
                {i18nAr.ar.admin.title}
              </Link>
            )}
            <Link href="/history" className="text-labelMd text-inkSoft hover:text-primary px-3 py-1.5 font-semibold rounded-lg hover:bg-primary/10 transition-colors">
              {i18nAr.ar.account.history}
            </Link>
            <span className="text-labelMd text-inkSoft hidden sm:inline font-medium">{principal.displayName}</span>
            {principal.avatarUrl ? (
              <img src={principal.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/30" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-red-gradient flex items-center justify-center text-white text-labelMd font-bold shadow-[0_4px_12px_-4px_rgba(229,62,62,0.4)]">
                {principal.displayName.slice(0, 1)}
              </div>
            )}
            <button
              type="button"
              onClick={() => signOut.mutate()}
              className="text-labelMd text-inkMuted hover:text-danger transition-colors px-3 py-1.5 font-medium rounded-lg hover:bg-danger/10"
            >
              {i18nAr.ar.account.signOut}
            </button>
          </>
        ) : (
          <Link
            href="/sign-in"
            className="text-labelMd text-primary hover:opacity-90 px-4 py-2 rounded-xl border-2 border-primary/40 font-bold hover:bg-primary/10 hover:border-primary/60 transition-all"
          >
            {i18nAr.ar.signIn.telegramAction}
          </Link>
        )}
      </div>
    </header>
  )
}

function BottomNavBar() {
  const [location] = useLocation()
  const principal = usePrincipal()
  const isHome = location === '/'
  const isResult = location.startsWith('/lookups/')
  const isHistory = location === '/history'
  const isPlans = location === '/plans'

  return (
    <nav
      className="fixed bottom-0 z-50 rounded-t-3xl bg-surfaceContainer/85 backdrop-blur-2xl border-t border-outlineVariant/25 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] h-20 pb-2 flex justify-around items-center w-full max-w-xl left-1/2 -translate-x-1/2"
      aria-label="التنقّل السفلي"
    >
      <NavItem icon="search" label="بحث" active={isHome} href="/" />
      <NavItem
        icon="history"
        label={i18nAr.ar.account.history}
        active={isHistory || isResult}
        href={principal ? '/history' : '/sign-in?next=%2Fhistory'}
      />
      <NavItem icon="diamond" label="الباقات" active={isPlans} href="/plans" />
      <NavItem
        icon="person"
        label="الحساب"
        href={principal ? '/' : '/sign-in'}
      />
    </nav>
  )
}

function NavItem({
  icon,
  label,
  active,
  href,
}: {
  icon: string
  label: string
  active?: boolean
  href?: string
}) {
  const inner = (
    <div
      className={cn(
        'flex flex-col items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer min-w-[64px] gap-1 py-2 px-3 rounded-2xl',
        active
          ? 'bg-red-gradient text-white shadow-[0_6px_20px_-6px_rgba(229,62,62,0.5)]'
          : 'text-inkMuted hover:text-primary hover:bg-primary/5'
      )}
    >
      <Icon name={icon} fill={active} size={24} />
      <span className={cn('text-labelSm font-semibold', active && 'font-bold')}>{label}</span>
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="focus-visible:outline-none">
        {inner}
      </Link>
    )
  }
  return inner
}
