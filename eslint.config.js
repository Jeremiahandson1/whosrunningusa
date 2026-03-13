import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        URLSearchParams: 'readonly',
        prompt: 'readonly',
        URL: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        FormData: 'readonly',
        clearTimeout: 'readonly',
        AbortController: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^(React|_)' }],
      'no-console': 'off',
    }
  },
  {
    ignores: ['dist/', 'node_modules/', 'backend/']
  }
]
