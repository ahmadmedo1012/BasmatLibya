/**
 * Custom ESLint rule that forbids physical-direction Tailwind utilities so the
 * codebase stays RTL-safe. Use logical-property utilities instead:
 *   left-* / right-*       → start-* / end-*
 *   pl-*  / pr-*           → ps-*    / pe-*
 *   ml-*  / mr-*           → ms-*    / me-*
 *   border-l / border-r    → border-s / border-e
 *   rounded-l / rounded-r  → rounded-s / rounded-e
 *   text-left / text-right → text-start / text-end
 *
 * Inspects string literals and JSX class attributes; matches whole-word tokens
 * separated by ASCII whitespace so substrings like "right-icon" inside other
 * identifiers are not flagged.
 */

const PHYSICAL_TOKEN = /(?:^|\s)(left-|right-|pl-|pr-|ml-|mr-|border-l|border-r|rounded-l|rounded-r|text-left|text-right)(?:\s|$|\/)/

/**
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow physical-direction Tailwind utilities; use logical-property utilities for RTL safety.',
    },
    schema: [],
    messages: {
      physical:
        'Use logical-property Tailwind utilities (start/end, ps/pe, ms/me, border-s/e, rounded-s/e, text-start/end) instead of "{{token}}".',
    },
  },
  create(context) {
    function check(node, value) {
      if (typeof value !== 'string') return
      const m = PHYSICAL_TOKEN.exec(' ' + value + ' ')
      if (m) {
        context.report({ node, messageId: 'physical', data: { token: m[1] } })
      }
    }
    return {
      Literal(node) {
        check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value && node.value.cooked)
      },
      JSXAttribute(node) {
        if (
          node.name &&
          (node.name.name === 'className' || node.name.name === 'class') &&
          node.value &&
          node.value.type === 'Literal'
        ) {
          check(node, node.value.value)
        }
      },
    }
  },
}
