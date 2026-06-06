import { useState } from 'react'
import { i18nAr } from '@basmat/shared'
import { Icon } from '../../lib/icon.js'
import { cn } from '../../lib/cn.js'
import { showToast } from '../primitives/Toast.js'

export function ShareLinkButton({
  lookupId,
  floating = false,
}: {
  lookupId: string
  floating?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/lookups/${lookupId}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const t = document.createElement('input')
      t.value = url
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      document.body.removeChild(t)
    }
    setCopied(true)
    showToast(i18nAr.ar.result.linkCopied, 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  if (floating) {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={i18nAr.ar.result.copyLink}
        className="flex items-center gap-2 btn-red-gradient text-onPrimary px-5 py-3 rounded-full shadow-primaryRing text-labelSm font-medium hover:scale-105 active:scale-95 transition-all"
      >
        <Icon name={copied ? 'check' : 'content_copy'} size={20} />
        {copied ? 'تم النسخ' : i18nAr.ar.result.copyLink}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={i18nAr.ar.result.copyLink}
      className={cn(
        'inline-flex items-center gap-2 px-5 h-11 rounded-2xl text-labelSm font-medium transition-all',
        'bg-surfaceContainer border border-outlineVariant text-ink hover:border-primary/50 active:scale-[0.98]'
      )}
    >
      <Icon name={copied ? 'check' : 'content_copy'} size={18} />
      {copied ? 'تم النسخ' : i18nAr.ar.result.copyLink}
    </button>
  )
}
