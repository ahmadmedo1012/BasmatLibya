import { useState } from 'react'
import type { Finding, Confidence, FindingMetadata } from '@basmat/shared'
import { i18nAr } from '@basmat/shared'
import { BidiIsolate } from '../../lib/rtl.js'
import { Icon } from '../../lib/icon.js'
import { cn } from '../../lib/cn.js'

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: i18nAr.ar.result.confidenceHigh,
  medium: i18nAr.ar.result.confidenceMedium,
  low: i18nAr.ar.result.confidenceLow,
}

const CONFIDENCE_ICON: Record<Confidence, string> = {
  high: 'check_circle',
  medium: 'pending',
  low: 'help',
}

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high: 'text-success',
  medium: 'text-warning',
  low: 'text-inkMuted',
}

function hasMetadata(m: FindingMetadata | null | undefined): m is FindingMetadata {
  if (!m) return false
  return Boolean(
    m.fullname ||
      m.bio ||
      m.imageUrl ||
      m.location ||
      m.followerCount != null ||
      m.followingCount != null ||
      m.blogUrl ||
      m.joinedAt ||
      m.isVerified ||
      m.company ||
      m.publicRepos != null
  )
}

function formatYear(iso?: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4})/.exec(iso)
  return m ? m[1]! : null
}

function formatNumber(n?: number | null): string | null {
  if (n == null) return null
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function FindingCard({
  finding,
  compact = false,
}: {
  finding: Finding
  compact?: boolean
}) {
  if (compact) {
    return (
      <li className="flex items-start justify-between gap-3 py-2 px-3 rounded-xl hover:bg-surfaceContainer/50 transition-colors">
        {finding.sourceUrl ? (
          <a
            href={finding.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-bodyMd text-inkSoft hover:text-primary transition-colors flex-1 min-w-0 truncate font-medium"
          >
            <BidiIsolate lang={finding.language ?? null}>{finding.title}</BidiIsolate>
          </a>
        ) : (
          <span className="text-bodyMd text-inkSoft flex-1 min-w-0 truncate font-medium">
            <BidiIsolate lang={finding.language ?? null}>{finding.title}</BidiIsolate>
          </span>
        )}
        <Icon
          name={CONFIDENCE_ICON[finding.confidence]}
          size={18}
          className={cn('shrink-0 mt-0.5', CONFIDENCE_COLOR[finding.confidence])}
        />
      </li>
    )
  }

  const md = finding.metadata ?? null
  const rich = hasMetadata(md)
  const [imgError, setImgError] = useState(false)

  return (
    <li className="rounded-2xl border border-outlineVariant/25 bg-surfaceContainerLow p-5 hover:bg-surfaceContainer transition-all hover:border-primary/20">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        {!imgError && rich && md?.imageUrl ? (
          <a
            href={finding.sourceUrl ?? md.imageUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <img
              src={md.imageUrl}
              alt=""
              loading="lazy"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-outlineVariant/40 bg-surfaceContainer"
              onError={() => setImgError(true)}
            />
          </a>
        ) : null}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {rich && md?.fullname ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-ink font-bold text-bodyLg leading-snug">
                    <BidiIsolate lang={finding.language ?? null}>{md.fullname}</BidiIsolate>
                  </span>
                  {md.isVerified === true && (
                    <span className="size-6 rounded-full bg-primary/15 flex items-center justify-center">
                      <Icon name="verified" size={16} className="text-primary" />
                    </span>
                  )}
                </div>
              ) : null}
              {finding.sourceUrl ? (
                <a
                  href={finding.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'block hover:text-primary transition-colors leading-snug mt-0.5',
                    rich && md?.fullname ? 'text-bodyMd text-inkSoft font-medium' : 'text-ink font-bold text-bodyLg'
                  )}
                >
                  <BidiIsolate lang={finding.language ?? null}>{finding.title}</BidiIsolate>
                </a>
              ) : (
                <span
                  className={cn(
                    'leading-snug mt-0.5 block',
                    rich && md?.fullname ? 'text-bodyMd text-inkSoft font-medium' : 'text-ink font-bold text-bodyLg'
                  )}
                >
                  <BidiIsolate lang={finding.language ?? null}>{finding.title}</BidiIsolate>
                </span>
              )}
            </div>
            <span
              className={cn(
                'pill shrink-0 font-bold',
                finding.confidence === 'high'
                  ? 'bg-success/15 text-success border border-success/30'
                  : finding.confidence === 'medium'
                    ? 'bg-warning/15 text-warning border border-warning/30'
                    : 'bg-surfaceVariant text-inkMuted border border-outlineVariant'
              )}
            >
              <Icon name={CONFIDENCE_ICON[finding.confidence]} size={14} />
              {CONFIDENCE_LABEL[finding.confidence]}
            </span>
          </div>

          {/* Bio */}
          {rich && md?.bio ? (
            <p className="mt-3 text-bodyMd text-inkSoft leading-relaxed line-clamp-3">
              <BidiIsolate lang={finding.language ?? null}>{md.bio}</BidiIsolate>
            </p>
          ) : finding.snippet ? (
            <p className="mt-3 text-bodyMd text-inkSoft leading-relaxed">
              <BidiIsolate lang={finding.language ?? null}>{finding.snippet}</BidiIsolate>
            </p>
          ) : null}

          {/* Stats row */}
          {rich ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {md?.followerCount != null && (
                <Stat icon="group" label={`${formatNumber(md.followerCount)} متابع`} />
              )}
              {md?.followingCount != null && (
                <Stat icon="person_add" label={`يتابع ${formatNumber(md.followingCount)}`} />
              )}
              {md?.location && <Stat icon="place" label={md.location} ltr />}
              {md?.company && <Stat icon="business" label={md.company} ltr />}
              {md?.publicRepos != null && (
                <Stat icon="folder_open" label={`${md.publicRepos} مستودع`} />
              )}
              {formatYear(md?.joinedAt) && (
                <Stat icon="event" label={`منذ ${formatYear(md?.joinedAt)}`} />
              )}
              {md?.blogUrl && (
                <a
                  href={md.blogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors text-labelMd text-inkSoft"
                  dir="ltr"
                >
                  <Icon name="link" size={16} />
                  <span className="font-latin truncate max-w-[180px]">{md.blogUrl.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
          ) : null}

          {/* Source row */}
          <div className="mt-4 flex items-center gap-2 text-labelSm text-inkMuted bg-surfaceContainer/50 rounded-lg px-3 py-2 w-fit">
            <Icon name={finding.sourceUrl ? 'link' : 'source'} size={16} className="text-primary" />
            <span className="font-medium">{i18nAr.ar.result.sourceLabel}:</span>
            <BidiIsolate lang="en" className="text-inkSoft font-semibold">
              {finding.sourceName}
            </BidiIsolate>
          </div>
        </div>
      </div>
    </li>
  )
}

function Stat({ icon, label, ltr }: { icon: string; label: string; ltr?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-labelMd text-inkSoft bg-surfaceContainer/60 rounded-lg px-2.5 py-1" dir={ltr ? 'ltr' : undefined}>
      <Icon name={icon} size={16} className="text-inkMuted shrink-0" />
      <span className={ltr ? 'font-latin' : 'font-medium'}>{label}</span>
    </span>
  )
}
