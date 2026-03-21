// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      // Downgrade to warn -- codebase uses any in many legitimate places
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow @ts-ignore in addition to @ts-expect-error
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Unused vars as warn not error
      '@typescript-eslint/no-unused-vars': 'warn',
      // console statements are expected in an SDK for debugging
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
