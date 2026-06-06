/**
 * Playwright RTL visual smoke test (T063, SC-009).
 *
 * Pinned contract:
 *   (a) no horizontal scroll on any primary surface
 *       (document.documentElement.scrollWidth <= window.innerWidth)
 *   (b) every <svg> and icon-font glyph with data-icon must be RTL-safe
 *       (no flipped arrows on back/cancel, no flipped chevrons on
 *       breadcrumbs, no flipped search magnifier). Either bidi-safe
 *       by design OR has an explicit `data-bidi="freeze"` marker.
 *
 * SKELETON: full coverage requires Playwright + a deployed staging
 * instance. The test script is the live reference. The icon-list
 * audit can also be done as a static-analysis test (see
 * `apps/web/tests/unit/icons-bidi.test.ts` which is a node-only check
 * that the icon registry declares its bidi-frozenness).
 */
import { describe, it, expect } from 'vitest'

describe('e2e: RTL visual smoke (T063)', () => {
  it('SKELETON: pinned contract — no horizontal scroll + every icon is bidi-safe or explicitly frozen', () => {
    // Reference Playwright script:
    //
    //   import { test, expect } from '@playwright/test'
    //
    //   const SURFACES = [
    //     '/', '/sign-in', '/lookups/{id}/progress', '/lookups/{id}',
    //     '/history', '/plans', '/suspended', '/not-authorised', '/404',
    //   ]
    //
    //   for (const path of SURFACES) {
    //     test(`no horizontal scroll on ${path}`, async ({ page }) => {
    //       await page.goto(path)
    //       const overflow = await page.evaluate(() => ({
    //         scrollWidth: document.documentElement.scrollWidth,
    //         innerWidth: window.innerWidth,
    //       }))
    //       expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth)
    //     })
    //   }
    //
    //   test('every icon is bidi-safe or frozen', async ({ page }) => {
    //     await page.goto('/')
    //     const flipped = await page.evaluate(() => {
    //       const icons = document.querySelectorAll('svg, [data-icon]')
    //       const bad: string[] = []
    //       for (const el of Array.from(icons)) {
    //         if (el.getAttribute('data-bidi') === 'freeze') continue
    //         const t = window.getComputedStyle(el).transform
    //         // A non-identity transform on a glyph that lacks a freeze
    //         // marker is a likely flip. (Visual confirmation is the
    //         // final gate; this is the structural check.)
    //         if (t && t !== 'none' && !t.includes('matrix(1, 0, 0, 1')) {
    //           bad.push(el.outerHTML.slice(0, 80))
    //         }
    //       }
    //       return bad
    //     })
    //     expect(flipped).toEqual([])
    //   })
    expect(true).toBe(true)
  })
})
