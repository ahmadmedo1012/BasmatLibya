import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import noPhysicalRtlProperties from './tooling/eslint-rules/no-physical-rtl-properties.js'

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      '**/node_modules',
      '**/dist',
      '**/build',
      '**/coverage',
      'apps/server/src/db/migrations',
      '.specify',
      '.claude',
      'specs',
      'playwright-report',
      'test-results',
      'tooling/eslint-rules',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: {
      basmat: {
        rules: {
          'no-physical-rtl-properties': noPhysicalRtlProperties,
        },
      },
    },
    rules: {
      'basmat/no-physical-rtl-properties': 'error',
    },
  }
)
