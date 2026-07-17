import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['**/*.{js,mjs}'],
    ...js.configs.recommended,
    languageOptions: { globals: globals.node },
    rules: {
      ...js.configs.recommended.rules,
      'no-regex-spaces': 'off',
      'no-useless-escape': 'off'
    }
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}', 'test/**/*.ts'],
    languageOptions: {
      ...config.languageOptions,
      globals: { ...globals.browser, ...globals.es2022 }
    }
  })),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }]
    }
  }
];
