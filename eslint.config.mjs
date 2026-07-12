import eslint from '@eslint/js'
import typescript from 'typescript-eslint'

export default typescript.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'vite.config.ts', 'vitest.config.ts'],
  },
  eslint.configs.recommended,
  ...typescript.configs.recommended,
)
