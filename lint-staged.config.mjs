export default {
  '*.{js,mjs,cjs,ts,mts,cts,tsx}': ['oxfmt --write', 'oxlint --fix'],
  '*.{json,md,yaml,yml}': ['oxfmt --write'],
}
