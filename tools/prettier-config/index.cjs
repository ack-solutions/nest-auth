// @ackplus/prettier-config — shared Prettier preset
//
// Consume from a package's package.json:
//   "prettier": "@ackplus/prettier-config"

/** @type {import('prettier').Config} */
module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  bracketSpacing: true,
  bracketSameLine: false,
  endOfLine: 'lf',
  quoteProps: 'as-needed',
};
