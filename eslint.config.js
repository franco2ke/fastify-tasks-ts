import love from 'eslint-config-love';

export default [
  {
    ...love,
    files: ['src/**/*.ts'],
    rules: {
      ...love.rules,
      // Allow magic numbers for common HTTP status codes and limits
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [
            0, 1, 2, 3, 4, 5, 10, -1, 60, 100, 201, 204, 255, 300, 400, 401, 403, 404, 500, 5432,
            86400, 604800,
          ],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
        },
      ],
      // Allow console.log in development
      'no-console': 'warn',
      // Less strict about explicit return types for simple functions
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Allow async functions without await (common in Fastify routes)
      '@typescript-eslint/require-await': 'warn',
      // Less strict about strict boolean expressions
      '@typescript-eslint/strict-boolean-expressions': 'warn',
      // Disable overly strict type safety rules for Fastify project
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-type-assertion': 'warn',
      '@typescript-eslint/prefer-destructuring': [
        'error',
        {
          object: false, // Allow direct property access for objects but not arrays
        },
      ],
      '@typescript-eslint/method-signature-style': 'off',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      // Allow empty interfaces and object types (common in Fastify plugins)
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      // Disable remaining error-causing rules for Fastify project
      '@typescript-eslint/no-unsafe-call': 'warn',
    },
  },
];
