module.exports = {
  env: {
    es2019: true,
    node: false,
  },
  globals: {
    // SuiteScript globals
    define: 'readonly',
    require: 'readonly',
    log: 'readonly',
  },
  plugins: ['suitescript'],
  extends: ['plugin:suitescript/recommended'],
  rules: {
    // ── SuiteScript plugin rules ──────────────────────────────────────
    'suitescript/api-version': 'error',
    'suitescript/script-type': 'error',
    'suitescript/entry-points': 'warn',
    'suitescript/log-args': 'warn',
    'suitescript/no-extra-modules': 'error',

    // ── Custom Softype rules ──────────────────────────────────────────

    // No record.load / record.save inside loops (N+1 pattern)
    'no-restricted-syntax': [
      'warn',
      {
        selector:
          'ForStatement CallExpression[callee.object.name="record"][callee.property.name=/^(load|save)$/]',
        message: 'Avoid record.load/save inside loops — N+1 governance violation.',
      },
      {
        selector:
          'ForInStatement CallExpression[callee.object.name="record"][callee.property.name=/^(load|save)$/]',
        message: 'Avoid record.load/save inside loops — N+1 governance violation.',
      },
      {
        selector:
          'ForOfStatement CallExpression[callee.object.name="record"][callee.property.name=/^(load|save)$/]',
        message: 'Avoid record.load/save inside loops — N+1 governance violation.',
      },
      {
        selector:
          'WhileStatement CallExpression[callee.object.name="record"][callee.property.name=/^(load|save)$/]',
        message: 'Avoid record.load/save inside loops — N+1 governance violation.',
      },
    ],

    // No console.log in server-side scripts (use log.debug instead)
    'no-console': 'warn',

    // Enforce === over == to avoid loose type coercion bugs
    eqeqeq: ['warn', 'always'],

    // Disallow unused variables (catches copy-paste drift in multi-copy repos)
    'no-unused-vars': ['warn', { vars: 'all', args: 'none' }],

    // Disallow var (use var in SS2.x is fine but let/const is safer)
    'no-var': 'warn',
  },

  // Ignore vendor/lib files and node_modules
  ignorePatterns: ['node_modules/', '*.min.js', 'scripts/', '__tests__/', 'coverage/', 'jest.config.js', '.eslintrc.js'],
};
