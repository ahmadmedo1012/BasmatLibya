/** Design tokens — typography. RTL/Arabic-first scale. */

export const fontFamilies = {
  arabic: ['Tajawal', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
  latin: ['Inter', 'system-ui', 'sans-serif'],
  icons: ['"Material Symbols Outlined"'],
} as const

/**
 * Type scale — sizes calibrated for Tajawal at Arabic body weight.
 * Values are CSS strings so they can be emitted as Tailwind extend.fontSize entries.
 */
export const fontSize = {
  'label-sm': ['12px', { lineHeight: '1.3', letterSpacing: '0.01em', fontWeight: '500' }],
  'label-md': ['13px', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
  'body-md': ['15px', { lineHeight: '1.65', fontWeight: '400' }],
  'body-lg': ['17px', { lineHeight: '1.7', fontWeight: '400' }],
  title: ['20px', { lineHeight: '1.4', fontWeight: '700' }],
  'headline-md': ['22px', { lineHeight: '1.35', fontWeight: '700' }],
  'headline-lg': ['28px', { lineHeight: '1.25', fontWeight: '700' }],
  'display-mobile': ['38px', { lineHeight: '1.15', fontWeight: '800' }],
  'display-lg': ['56px', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.01em' }],
} as const
