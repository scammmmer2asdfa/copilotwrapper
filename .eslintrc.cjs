module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['out', 'dist', 'node_modules', 'resources', 'site/**/*.js'],
  overrides: [
    {
      files: ['src/renderer/**/*.{ts,tsx}'],
      env: { browser: true, node: false },
      extends: ['plugin:react-hooks/recommended']
    }
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off'
  }
};
