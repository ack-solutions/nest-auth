// @ackplus/eslint-config/react — adds React + Hooks rules
//
// Consume:
//   import reactConfig from '@ackplus/eslint-config/react';
//   export default reactConfig;

import base from './index.js';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': hooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...hooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',          // not needed with new JSX transform
      'react/prop-types': 'off',                  // we use TypeScript
      'react/display-name': 'off',
    },
  },
];
