import eslint from '@eslint/js'
import typescript from 'typescript-eslint'

export default typescript.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '**/.venv/**', '**/__pycache__/**', 'vite.config.ts', 'vitest.config.ts'],
  },
  eslint.configs.recommended,
  ...typescript.configs.recommended,
)
