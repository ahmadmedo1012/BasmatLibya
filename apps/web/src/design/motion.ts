/**
 * Motion helpers tied to design-tokens motion durations.
 * `useReducedMotion()` from framer-motion gates decorative variants.
 */
import { motion as tokens } from '@basmat/shared'
import type { Variants } from 'framer-motion'

export function ms(d: keyof typeof tokens.durations): number {
  return tokens.durations[d]
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: ms('base') / 1000, ease: [0.22, 1, 0.36, 1] } },
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: ms('fast') / 1000 } },
}

/** Zero-duration variant — use as fallback when user prefers reduced motion. */
export const reducedFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
}
