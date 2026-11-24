import { defineVitestConfig } from '@nuxt/test-utils/config'

// Node 25+ defines a global `localStorage` that is undefined unless
// --localstorage-file is given. It shadows happy-dom's while the Nuxt app
// boots, which floods the output with caught "reading 'getItem'" errors.
const nodeMajor = Number(process.versions.node.split('.')[0])

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    execArgv: nodeMajor >= 25 ? ['--no-experimental-webstorage'] : [],
  },
})
