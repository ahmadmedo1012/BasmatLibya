/** Design tokens — motion durations and easings. */
export const motion = {
  durations: {
    fast: 140,
    base: 220,
    slow: 340,
  },
  easings: {
    'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
    'in-out-soft': 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
  /**
   * Reduced-motion fallback factor. Multiply duration by this when the user
   * has `prefers-reduced-motion: reduce`. 0 collapses motion to instant.
   */
  reducedMotionFactor: 0,
} as const

export type MotionDuration = keyof typeof motion.durations
export type MotionEasing = keyof typeof motion.easings
