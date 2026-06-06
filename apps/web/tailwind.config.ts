import type { Config } from 'tailwindcss'
import rtl from 'tailwindcss-rtl'

/**
 * Refined palette — warmer, lower-saturation, more readable.
 *
 * Primary moves from neon red (#ff5252) to a deeper crimson (#e55a5a) with a
 * matte feel; the background gains a faint warm undertone (#0d0a0c) instead of
 * near-pure black so the eyes don't have to fight pure-black contrast.
 * Surface tones are warmed slightly toward burgundy for cohesion.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Tajawal reads beautifully at small sizes and has an elegant display weight.
        arabic: ['Tajawal', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        latin: ['Inter', 'system-ui', 'sans-serif'],
        icons: ['"Material Symbols Outlined"'],
      },
      colors: {
        // Background ramp — warm dark, subtle burgundy undertone.
        background: '#0d0a0c',
        surface: '#13100f',
        surfaceContainerLowest: '#0a0808',
        surfaceContainerLow: '#161312',
        surfaceContainer: '#1c1716',
        surfaceContainerHigh: '#231c1b',
        surfaceContainerHighest: '#2a2221',
        surfaceBright: '#1e1817',
        surfaceVariant: '#241d1c',

        // Text ramp — warm-tinted off-white that's easy on the eyes.
        ink: '#f3ebe7', // primary text
        inkSoft: '#c9bdb8', // secondary text
        inkMuted: '#8b7d77', // tertiary / placeholders
        inkDim: '#5e524d', // disabled / footnotes

        // Primary — deeper, less neon crimson with better contrast on dark.
        primary: '#e55a5a',
        primaryHover: '#ed6e6e',
        primaryDeep: '#a02929',
        primarySoft: 'rgba(229, 90, 90, 0.12)',
        primaryRing: 'rgba(229, 90, 90, 0.30)',
        primaryContainer: '#3a1010',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#ffd9d6',

        // Borders.
        outline: '#7c6e69',
        outlineVariant: 'rgba(255, 255, 255, 0.07)',
        outlineVariantStrong: 'rgba(229, 90, 90, 0.18)',

        // Status.
        success: '#4ade80',
        successSoft: 'rgba(74, 222, 128, 0.12)',
        warning: '#f4b860', // softer than #fbbf24
        warningSoft: 'rgba(244, 184, 96, 0.12)',
        danger: '#ef8c8c',
        dangerSoft: 'rgba(239, 140, 140, 0.12)',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        full: '9999px',
      },
      spacing: {
        marginMobile: '20px',
        marginDesktop: '64px',
        gutter: '24px',
        maxWidth: '1200px',
      },
      fontSize: {
        // Sizes calibrated for Tajawal at Arabic body weight.
        labelSm: ['12px', { lineHeight: '1.3', letterSpacing: '0.01em', fontWeight: '500' }],
        labelMd: ['13px', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
        bodyMd: ['15px', { lineHeight: '1.65', fontWeight: '400' }],
        bodyLg: ['17px', { lineHeight: '1.7', fontWeight: '400' }],
        title: ['20px', { lineHeight: '1.4', fontWeight: '700' }],
        headlineMd: ['22px', { lineHeight: '1.35', fontWeight: '700' }],
        headlineLg: ['28px', { lineHeight: '1.25', fontWeight: '700' }],
        displayMobile: ['38px', { lineHeight: '1.15', fontWeight: '800' }],
        displayLg: ['56px', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        glow: '0 0 24px rgba(229, 90, 90, 0.18)',
        glowStrong: '0 0 36px rgba(229, 90, 90, 0.35)',
        glowSoft: '0 0 18px rgba(229, 90, 90, 0.10)',
        primaryRing:
          '0 12px 32px -10px rgba(229, 90, 90, 0.5), 0 4px 12px -4px rgba(0, 0, 0, 0.4)',
        card: '0 18px 40px -22px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      },
      backgroundImage: {
        'red-gradient': 'linear-gradient(135deg, #e55a5a 0%, #9d2a2a 100%)',
        'red-gradient-soft':
          'linear-gradient(135deg, rgba(229, 90, 90, 0.16) 0%, rgba(157, 42, 42, 0.10) 100%)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        aurora: {
          '0%': { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
          '50%': { transform: 'translate3d(2%,-3%,0) rotate(180deg) scale(1.15)' },
          '100%': { transform: 'translate3d(0,0,0) rotate(360deg) scale(1)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        floatSlow: 'floatSlow 6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        aurora: 'aurora 22s ease-in-out infinite',
        auroraFast: 'aurora 14s ease-in-out infinite reverse',
        breathe: 'breathe 4s ease-in-out infinite',
        gradientShift: 'gradientShift 8s ease infinite',
        slideUp: 'slideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [rtl],
} satisfies Config
