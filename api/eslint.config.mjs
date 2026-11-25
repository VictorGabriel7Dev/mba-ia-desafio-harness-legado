// Configuração do ESLint (flat config) da api, usada pelo gate G2.
//
// Liga, no mínimo, as duas regras exigidas pela invariante:
//   @typescript-eslint/no-unused-vars  - variável ou import sem uso;
//   @typescript-eslint/no-explicit-any - uso de "any" explícito.
// Ambas como erro. O gate trata qualquer erro ou warning como violação.
// Só varremos src/ (os scripts de gate e os arquivos de configuração ficam de fora).

import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)
