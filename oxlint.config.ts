import { base, depend, typeAware, unicorn } from '@infra-x/code-quality/lint'
import { defineConfig } from 'oxlint'

// typeAware() is root-config-only; package configs extend this file.
export default defineConfig({
  extends: [base(), typeAware(), unicorn(), depend()],
  rules: {
    'import/no-cycle': 'error',
  },
})
