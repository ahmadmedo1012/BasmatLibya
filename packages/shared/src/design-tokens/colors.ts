/**
 * Design tokens — semantic colours.
 *
 * Inherits from feature 001's warm-dark Tajawal/Inter palette so the redesign
 * is a coherent evolution rather than a reset. Every (fg, bg) combination
 * declared in `validContrastPairs` is asserted against WCAG 2.1 AA in tests.
 */

export const lightColors = {
  'bg-canvas': '#ffffff',
  'bg-elevated': '#f7f4f3',
  'bg-subtle': '#fafafa',
  'fg-default': '#1a1416',
  'fg-muted': '#5e524d',
  'fg-soft': '#8b7d77',
  accent: '#c44545',
  'accent-fg': '#ffffff',
  'accent-soft': 'rgba(196, 69, 69, 0.10)',
  danger: '#b42a2a',
  'danger-fg': '#ffffff',
  'danger-soft': 'rgba(180, 42, 42, 0.10)',
  success: '#1a7a3e',
  'success-soft': 'rgba(26, 122, 62, 0.10)',
  warning: '#a86d10',
  'warning-soft': 'rgba(168, 109, 16, 0.10)',
  'border-subtle': 'rgba(0, 0, 0, 0.08)',
  'border-strong': 'rgba(0, 0, 0, 0.18)',
} as const

export const darkColors = {
  'bg-canvas': '#0d0a0c',
  'bg-elevated': '#13100f',
  'bg-subtle': '#161312',
  'fg-default': '#f3ebe7',
  'fg-muted': '#c9bdb8',
  'fg-soft': '#8b7d77',
  accent: '#e55a5a',
  'accent-fg': '#ffffff',
  'accent-soft': 'rgba(229, 90, 90, 0.12)',
  danger: '#ef8c8c',
  'danger-fg': '#1a0a0a',
  'danger-soft': 'rgba(239, 140, 140, 0.12)',
  success: '#4ade80',
  'success-soft': 'rgba(74, 222, 128, 0.12)',
  warning: '#f4b860',
  'warning-soft': 'rgba(244, 184, 96, 0.12)',
  'border-subtle': 'rgba(255, 255, 255, 0.07)',
  'border-strong': 'rgba(255, 255, 255, 0.18)',
} as const

export type ColorToken = keyof typeof darkColors

/**
 * Pairs that the design system declares as valid foreground/background
 * combinations. Tested for WCAG 2.1 AA contrast in `design-tokens-contrast.test.ts`.
 */
export const validContrastPairs: ReadonlyArray<{ fg: ColorToken; bg: ColorToken; minRatio: number }> = [
  { fg: 'fg-default', bg: 'bg-canvas', minRatio: 7.0 }, // AAA body
  { fg: 'fg-default', bg: 'bg-elevated', minRatio: 7.0 },
  { fg: 'fg-muted', bg: 'bg-canvas', minRatio: 4.5 }, // AA body
  { fg: 'accent-fg', bg: 'accent', minRatio: 4.5 },
  { fg: 'danger-fg', bg: 'danger', minRatio: 4.5 },
]
