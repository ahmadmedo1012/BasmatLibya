import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { i18nAr, type AdminUserSummary } from '@basmat/shared'
import { listUsers, suspendUser, unsuspendUser, deleteUser, AdminApiError } from '../../lib/admin-api.js'
import { cn } from '../../lib/cn.js'

export function UsersPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'active' | 'suspended' | 'all'>('all')
  const [sort, setSort] = useState<'joined_desc' | 'last_seen_desc'>('last_seen_desc')
  const labels = i18nAr.ar.admin.users

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', statusFilter, sort],
    queryFn: () =>
      listUsers({
        status: statusFilter === 'all' ? undefined : statusFilter,
        sort,
        limit: 50,
      }),
  })

  const suspend = useMutation({
    mutationFn: suspendUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
  const unsuspend = useMutation({
    mutationFn: unsuspendUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
  const remove = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-headlineMd font-bold text-ink mb-3">{i18nAr.ar.admin.sections.users}</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <FilterChip label="الكل" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          <FilterChip label={labels.filters.statusActive} active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
          <FilterChip label={labels.filters.statusSuspended} active={statusFilter === 'suspended'} onClick={() => setStatusFilter('suspended')} />
          <span className="text-inkMuted mx-2">·</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'joined_desc' | 'last_seen_desc')}
            className="bg-surface border border-outlineVariant rounded px-2 py-1 text-labelMd"
          >
            <option value="last_seen_desc">{labels.sort.lastSeen}</option>
            <option value="joined_desc">{labels.sort.joined}</option>
          </select>
        </div>
      </header>

      {isLoading && <div className="text-inkMuted">جاري التحميل…</div>}
      {error instanceof AdminApiError && (
        <div className="glass-card p-4 rounded-xl text-danger">{error.payload.messageAr}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-outlineVariant/30">
        <table className="w-full text-bodyMd">
          <thead className="bg-surfaceContainerLow text-labelMd text-inkSoft text-start">
            <tr>
              <th className="text-start px-3 py-2">المستخدم</th>
              <th className="text-start px-3 py-2 hidden sm:table-cell">الدور</th>
              <th className="text-start px-3 py-2 hidden sm:table-cell">الحالة</th>
              <th className="text-start px-3 py-2 hidden md:table-cell">آخر نشاط</th>
              <th className="text-start px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onSuspend={() => suspend.mutate(u.id)}
                onUnsuspend={() => unsuspend.mutate(u.id)}
                onRemove={() => {
                  if (confirm(`${labels.removeConfirm.title}\n${labels.removeConfirm.body}`))
                    remove.mutate(u.id)
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UserRow({
  user,
  onSuspend,
  onUnsuspend,
  onRemove,
}: {
  user: AdminUserSummary
  onSuspend: () => void
  onUnsuspend: () => void
  onRemove: () => void
}) {
  const labels = i18nAr.ar.admin.users
  return (
    <tr className="border-t border-outlineVariant/20">
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primarySoft flex items-center justify-center text-primary text-labelMd font-bold">
              {user.displayName.slice(0, 1)}
            </div>
          )}
          <div>
            <div className="text-ink">{user.displayName}</div>
            <div className="text-labelSm text-inkMuted font-latin">
              {user.username ? '@' + user.username : `id:${user.telegramId}`}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 hidden sm:table-cell">
        <span className={cn('pill', user.role === 'owner' ? 'bg-primarySoft text-primary' : 'bg-surfaceContainer text-inkSoft')}>
          {user.role === 'owner' ? labels.filters.roleOwner : labels.filters.roleUser}
        </span>
      </td>
      <td className="px-3 py-2 hidden sm:table-cell">
        <span className={cn('pill', user.status === 'suspended' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
          {user.status === 'suspended' ? labels.filters.statusSuspended : labels.filters.statusActive}
        </span>
      </td>
      <td className="px-3 py-2 hidden md:table-cell text-labelMd text-inkSoft font-latin">
        {new Date(user.lastSeenAt).toLocaleDateString('ar-LY')}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2 flex-wrap">
          {user.status === 'active' ? (
            <button onClick={onSuspend} className="text-labelMd text-warning border border-warning/40 rounded px-2 py-1">
              {labels.actions.suspend}
            </button>
          ) : (
            <button onClick={onUnsuspend} className="text-labelMd text-success border border-success/40 rounded px-2 py-1">
              {labels.actions.unsuspend}
            </button>
          )}
          <button onClick={onRemove} className="text-labelMd text-danger border border-danger/40 rounded px-2 py-1">
            {labels.actions.remove}
          </button>
        </div>
      </td>
    </tr>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'pill border transition-colors',
        active
          ? 'bg-primarySoft text-primary border-primary/40'
          : 'bg-surfaceContainerLow text-inkSoft border-outlineVariant/40 hover:border-primary/30'
      )}
    >
      {label}
    </button>
  )
}
