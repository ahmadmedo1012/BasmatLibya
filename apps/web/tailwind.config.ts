import type { Config } from 'tailwindcss'
import rtl from 'tailwindcss-rtl'

/**
 * VIBRANT PALETTE — bold, alive, high-contrast.
 *
 * Primary: vivid crimson-red (#e53e3e) — punchy, impossible to miss.
 * Background: deep warm black (#080606) — makes colors pop.
 * Surfaces: rich dark with warm burgundy undertones.
 * Text: bright warm whites for maximum readability.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Tajawal', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        latin: ['Inter', 'system-ui', 'sans-serif'],
        icons: ['"Material Symbols Outlined"'],
      },
      colors: {
        // Background ramp — deep, warm, makes colors pop.
        background: '#080606',
        surface: '#110e0d',
        surfaceContainerLowest: '#060404',
        surfaceContainerLow: '#14100f',
        surfaceContainer: '#1a1413',
        surfaceContainerHigh: '#221a18',
        surfaceContainerHighest: '#2a201e',
        surfaceBright: '#1c1614',
        surfaceVariant: '#241c1a',

        // Text ramp — bright, high-contrast.
        ink: '#fff5f0',       // primary text — bright warm white
        inkSoft: '#d4c4bc',   // secondary text — warm light
        inkMuted: '#9a8880',  // tertiary — muted but readable
        inkDim: '#6a5c56',    // disabled

        // Primary — vivid, punchy crimson.
        primary: '#e53e3e',
        primaryHover: '#ff5555',
        primaryDeep: '#b91c1c',
        primarySoft: 'rgba(229, 62, 62, 0.15)',
        primaryRing: 'rgba(229, 62, 62, 0.40)',
        primaryContainer: '#3d0e0e',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#ffdbdb',

        // Borders.
        outline: '#8a7872',
        outlineVariant: 'rgba(255, 255, 255, 0.08)',
        outlineVariantStrong: 'rgba(229, 62, 62, 0.22)',

        // Status.
        success: '#34d399',
        successSoft: 'rgba(52, 211, 153, 0.14)',
        warning: '#fbbf24',
        warningSoft: 'rgba(251, 191, 36, 0.14)',
        danger: '#f87171',
        dangerSoft: 'rgba(248, 113, 113, 0.14)',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        full: '9999px',
      },
      spacing: {
        marginMobile: '16px',
        marginDesktop: '80px',
        gutter: '24px',
        maxWidth: '1280px',
      },
      fontSize: {
        labelSm: ['12px', { lineHeight: '1.3', letterSpacing: '0.01em', fontWeight: '600' }],
        labelMd: ['14px', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '600' }],
        bodyMd: ['16px', { lineHeight: '1.7', fontWeight: '400' }],
        bodyLg: ['18px', { lineHeight: '1.75', fontWeight: '400' }],
        title: ['22px', { lineHeight: '1.35', fontWeight: '700' }],
        headlineMd: ['26px', { lineHeight: '1.3', fontWeight: '800' }],
        headlineLg: ['34px', { lineHeight: '1.2', fontWeight: '800' }],
        displayMobile: ['44px', { lineHeight: '1.1', fontWeight: '900' }],
        displayLg: ['68px', { lineHeight: '1.05', fontWeight: '900', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        glow: '0 0 30px rgba(229, 62, 62, 0.25)',
        glowStrong: '0 0 50px rgba(229, 62, 62, 0.45)',
        glowSoft: '0 0 20px rgba(229, 62, 62, 0.12)',
        primaryRing:
          '0 16px 40px -12px rgba(229, 62, 62, 0.55), 0 4px 16px -4px rgba(0, 0, 0, 0.5)',
        card: '0 20px 50px -24px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      backgroundImage: {
        'red-gradient': 'linear-gradient(135deg, #e53e3e 0%, #991b1b 100%)',
        'red-gradient-hover': 'linear-gradient(135deg, #ff5555 0%, #b91c1c 100%)',
        'red-gradient-soft':
          'linear-gradient(135deg, rgba(229, 62, 62, 0.2) 0%, rgba(153, 27, 27, 0.12) 100%)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
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
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(229, 62, 62, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(229, 62, 62, 0.6)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        floatSlow: 'floatSlow 6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        aurora: 'aurora 22s ease-in-out infinite',
        auroraFast: 'aurora 14s ease-in-out infinite reverse',
        breathe: 'breathe 4s ease-in-out infinite',
        gradientShift: 'gradientShift 6s ease infinite',
        slideUp: 'slideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        pulseGlow: 'pulseGlow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [rtl],
} satisfies Config
