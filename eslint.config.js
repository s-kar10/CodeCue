import js from '@eslint/js';

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      globals: {
        chrome: 'readonly', window: 'readonly', document: 'readonly', location: 'readonly',
        fetch: 'readonly', AbortController: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        Date: 'readonly', URL: 'readonly', crypto: 'readonly'
      }
    },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 'no-console': ['error', { allow: ['warn', 'error'] }] }
  },
  { files: ['content/*.js', 'popup/*.js'], languageOptions: { sourceType: 'script' } }
];
