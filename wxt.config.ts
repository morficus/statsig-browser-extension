import { defineConfig } from 'wxt'

import { INTAKE_SITE_MATCHES } from './src/lib/intake-site'

// See https://wxt.dev/api/config.html
// Pins the CRX id so the extension origin (chrome-extension://<id>) stays stable across rebuilds.
// Public half of the signing keypair — not a secret.
const CRX_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApaZtQsLgIb4kK9d8LcrHeINf+TZawNvCt7U+bpk0rcoT7x4yd/YF9ESt/rqQzNGAMHXmkus26RfIdr1fSBu6/Ikw41L/gSTDMcS8sZiIz5V/E0iDVUUeDwFA7+B6trIeiS2M1eUMYgjUS9aHYf5qFSB8xpyzMX9ZdDlkPQes0A5TU85aPfFyshEE1fbP7/VfWQgHSr4r4amjMSLx7kY8eFly3QGG5cL+1zgub+dAOO/s08cQ166Wj0XOt+sTlV/XuPog1pdDn2DQUDrLgbPit3Xxejlst9gmceZUQqFr5JuzXVtcutCOWba+KEoY7gQSvZYR35tKuigzEZyH+SynYwIDAQAB'

export default defineConfig({
  manifest: {
    action: {
      default_icon: {
        '128': 'icon/128.png',
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
      },
      default_title: 'Intake Experiment Testing',
    },
    description:
      'Spot-test Statsig experiments on the Intake Site: see your groups, force yourself into a group, and take screenshots.',
    host_permissions: ['https://statsigapi.net/*', ...INTAKE_SITE_MATCHES],
    icons: {
      '128': 'icon/128.png',
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '96': 'icon/96.png',
    },
    key: CRX_PUBLIC_KEY,
    name: 'Intake Experiment Testing',
    permissions: ['storage', 'scripting', 'activeTab'],
  },
  modules: ['@wxt-dev/module-react'],
})
