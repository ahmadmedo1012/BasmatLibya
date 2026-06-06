/**
 * Design tokens — single source of truth.
 *
 * Consumed by `apps/web/src/design/tailwind-preset.ts` (compile-time) and by
 * any future server-rendered surface (e.g. error pages, system emails).
 * The audit harness asserts every redesigned surface carries the
 * `data-design-system="bsl-002"` marker (R-09).
 */

export * from './colors.js'
export * from './typography.js'
export * from './spacing.js'
export * from './radii.js'
export * from './motion.js'

export const DESIGN_SYSTEM_VERSION = 'bsl-002' as const
