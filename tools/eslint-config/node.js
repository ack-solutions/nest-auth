// @ackplus/eslint-config/node — adds Node-specific globals + rules
//
// Consume:
//   import nodeConfig from '@ackplus/eslint-config/node';
//   export default nodeConfig;

import base from './index.js';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-process-exit': 'warn',
    },
  },
];
