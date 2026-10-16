/*
 * F00-T4: capture the Statsig SDK values on the Intake Site (OPEN-007), before and after the T3 writes.
 *
 * How to use:
 * 1. Open the staging assessment page (https://app.staging.talkiatry.com/assessment...).
 * 2. If your test names are different, edit the three constants below.
 * 3. Paste this whole file into the Chrome DevTools console, then press Enter.
 * 4. Send the JSON to Claude. The snippet also copies it to the clipboard.
 * 5. The last line shows your Stable ID for planning/phase0/.env. The JSON never holds it.
 *
 * It is read only: it writes no storage, sends no request, and does not change the page.
 * It finds the SDK the same way as src/lib/get-user-details-injector.ts.
 */
/* One self-contained paste: every helper lives inside one async IIFE, so the size, scoping, and
 * top-level-await rules for modules cannot apply. It reads untyped page globals and JSON, so every
 * value is `any` in plain JavaScript, and the no-unsafe rules cannot apply either. */
// oxlint-disable max-lines, max-statements, max-lines-per-function, no-inner-declarations, unicorn/consistent-function-scoping, unicorn/prefer-top-level-await
// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-call, typescript/no-unsafe-return

const EXPERIMENT = 'intake_ext_phase0_check'
const LAYER_EXPERIMENT = 'intake_ext_phase0_layer_check'
const LAYER_ID = ''

void (async () => {
  const DROPPED_KEYS = new Set(['user', 'evaluated_keys', 'derived_fields'])
  const CONFIG_MAPS = ['dynamic_configs', 'layer_configs']
  const CACHED_EVALUATIONS_PREFIX = 'statsig.cached.evaluations.'
  const STABLE_ID_PREFIX = 'statsig.stable_id.'
  const DJB2_MULTIPLIER = 31
  const HEX_RADIX = 16

  const output = {}
  const secrets = { customIds: [], email: '', stableId: '', userId: '' }
  // DevTools offers `copy` only while the paste runs, so keep it before the first `await`.
  // oxlint-disable-next-line no-undef
  const copyToClipboard = typeof copy === 'function' ? copy : null

  function isRecord(value) {
    return typeof value === 'object' && value !== null
  }

  function typeName(value) {
    if (value === null) {
      return 'null'
    }
    if (Array.isArray(value)) {
      return 'array'
    }
    return typeof value
  }

  function shapeOf(entry) {
    if (!isRecord(entry)) {
      return null
    }
    return Object.fromEntries(Object.entries(entry).map(([field, value]) => [field, typeName(value)]))
  }

  /** Statsig's DJB2 variant. The same as src/lib/djb2.ts, which a console paste cannot import. */
  function djb2(value) {
    let hash = 0
    for (let index = 0; index < value.length; index++) {
      // oxlint-disable-next-line unicorn/prefer-code-point -- Statsig hashes UTF-16 code units
      hash = Math.imul(hash, DJB2_MULTIPLIER) + value.charCodeAt(index)
    }
    return String(hash >>> 0)
  }

  async function candidatesFor(name) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name)))
    return {
      djb2: djb2(name),
      raw: name,
      sha256Base64: btoa(String.fromCodePoint(...digest)),
      sha256Hex: Array.from(digest, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join(''),
    }
  }

  function readStorageKeys() {
    const keys = []
    for (let index = 0; index < globalThis.localStorage.length; index++) {
      const key = globalThis.localStorage.key(index)
      if (key !== null) {
        keys.push(key)
      }
    }
    return keys
  }

  /** The same globals and order as getStatsigInstance() in the injector. */
  function findInstance() {
    const win = globalThis
    if (win.statsig) {
      if (typeof win.statsig.getCurrentUser === 'function') {
        return { foundBy: 'window.statsig (getCurrentUser)', instance: win.statsig }
      }
      if (win.statsig._user || win.statsig.identity) {
        return { foundBy: 'window.statsig (_user or identity)', instance: win.statsig }
      }
    }
    if (win.__STATSIG__) {
      if (win.__STATSIG__.instances) {
        const instances = Object.values(win.__STATSIG__.instances)
        if (instances.length > 0) {
          return { foundBy: 'window.__STATSIG__.instances (first of the map)', instance: instances[0] }
        }
      }
      if (win.__STATSIG__.firstInstance) {
        return { foundBy: 'window.__STATSIG__.firstInstance', instance: win.__STATSIG__.firstInstance }
      }
    }
    if (win.__STATSIG_JS_SDK__?.instance) {
      return { foundBy: 'window.__STATSIG_JS_SDK__.instance', instance: win.__STATSIG_JS_SDK__.instance }
    }
    return { foundBy: null, instance: null }
  }

  /** The same order as getStableID() in the injector, then the first statsig.stable_id.* key. */
  function findStableId(instance, storageKeys) {
    if (instance) {
      if (typeof instance.getStableID === 'function') {
        const id = instance.getStableID()
        if (id) {
          return { id, source: 'instance.getStableID()' }
        }
      }
      if (typeof instance.getContext === 'function') {
        const id = instance.getContext()?.stableID
        if (id) {
          return { id, source: 'instance.getContext().stableID' }
        }
      }
      const first = globalThis.__STATSIG__?.firstInstance
      if (first && typeof first.getContext === 'function') {
        const id = first.getContext()?.stableID
        if (id) {
          return { id, source: 'window.__STATSIG__.firstInstance.getContext().stableID' }
        }
      }
      if (instance._stableID) {
        return { id: instance._stableID, source: 'instance._stableID' }
      }
      if (instance.identity?.stableID) {
        return { id: instance.identity.stableID, source: 'instance.identity.stableID' }
      }
    }
    const key = storageKeys.find((name) => name.startsWith(STABLE_ID_PREFIX))
    if (key) {
      const raw = globalThis.localStorage.getItem(key)
      let id = raw
      try {
        const parsed = JSON.parse(raw ?? 'null')
        if (typeof parsed === 'string') {
          id = parsed
        }
      } catch {
        // Not JSON: keep the raw value
      }
      if (id) {
        return { id, source: `localStorage ${key}` }
      }
    }
    return { id: null, source: null }
  }

  function rememberUser(user) {
    if (!isRecord(user)) {
      return
    }
    if (typeof user.userID === 'string' || typeof user.userID === 'number') {
      secrets.userId = String(user.userID)
    }
    if (typeof user.email === 'string') {
      secrets.email = user.email
    }
    if (isRecord(user.customIDs)) {
      for (const value of Object.values(user.customIDs)) {
        if (typeof value === 'string' || typeof value === 'number') {
          secrets.customIds.push(String(value))
        }
      }
    }
  }

  /** Replaces each secret, in its JSON-escaped form, as a literal string. Longest first. */
  function sanitize(text) {
    const pairs = [
      [secrets.stableId, '<stable-id>'],
      [secrets.userId, '<user-id>'],
      [secrets.email, '<email>'],
      ...secrets.customIds.map((id) => [id, '<custom-id>']),
    ].filter(([value]) => value !== '')
    pairs.sort((left, right) => right[0].length - left[0].length)
    let result = text
    for (const [value, mask] of pairs) {
      result = result.split(JSON.stringify(value).slice(1, -1)).join(mask)
    }
    return result
  }

  function describeTopLevel(values) {
    const topLevel = {}
    const dropped = []
    for (const [key, value] of Object.entries(values)) {
      if (DROPPED_KEYS.has(key)) {
        dropped.push(key)
      } else if (isRecord(value)) {
        topLevel[key] = { keyCount: Object.keys(value).length, type: typeName(value) }
      } else {
        topLevel[key] = { type: typeName(value), value }
      }
    }
    return { dropped, topLevel }
  }

  async function checkHashes(values) {
    const maps = {}
    for (const mapName of CONFIG_MAPS) {
      maps[mapName] = isRecord(values[mapName]) ? values[mapName] : {}
    }
    const hashCheck = {}
    const entries = {}
    let anyUnmatched = false
    const names = [EXPERIMENT, LAYER_EXPERIMENT, LAYER_ID].filter((value) => value !== '')
    const allCandidates = await Promise.all(names.map((name) => candidatesFor(name)))
    for (const [position, name] of names.entries()) {
      const candidates = allCandidates[position]
      const matched = []
      for (const [kind, candidate] of Object.entries(candidates)) {
        for (const mapName of CONFIG_MAPS) {
          if (Object.hasOwn(maps[mapName], candidate)) {
            matched.push(`${kind} in ${mapName}`)
            entries[name] = { ...entries[name], [mapName]: maps[mapName][candidate] }
          }
        }
      }
      if (matched.length === 0) {
        anyUnmatched = true
      }
      hashCheck[name] = { candidates, matched: matched.length > 0 ? matched : 'none' }
    }
    const sampleShape = {}
    for (const mapName of CONFIG_MAPS) {
      sampleShape[mapName] = shapeOf(Object.values(maps[mapName])[0])
    }
    const result = { entries, hashCheck, sampleShape }
    if (anyUnmatched) {
      result.unmatchedConfigKeys = Object.fromEntries(
        CONFIG_MAPS.map((mapName) => [mapName, Object.keys(maps[mapName])]),
      )
    }
    return result
  }

  function describeCachedEvaluations(storageKeys, values) {
    const key = storageKeys.find((name) => name.startsWith(CACHED_EVALUATIONS_PREFIX))
    if (!key) {
      return { found: false }
    }
    const described = { found: true, key }
    let entry = null
    try {
      entry = JSON.parse(globalThis.localStorage.getItem(key) ?? 'null')
    } catch {
      described.parsesAsJson = false
      return described
    }
    described.fields = shapeOf(entry)
    if (!isRecord(entry)) {
      return described
    }
    for (const field of ['source', 'receivedAt']) {
      if (Object.hasOwn(entry, field)) {
        described[field] = entry[field]
      }
    }
    let data = null
    try {
      data = typeof entry.data === 'string' ? JSON.parse(entry.data) : null
    } catch {
      data = null
    }
    described.dataParsesAsJson = isRecord(data)
    described.dataHasSameTopLevelKeysAsValues =
      isRecord(data) && isRecord(values)
        ? JSON.stringify(Object.keys(data).toSorted()) === JSON.stringify(Object.keys(values).toSorted())
        : null
    return described
  }

  function print() {
    const text = sanitize(JSON.stringify(output, null, 2))
    console.log(text)
    if (copyToClipboard) {
      try {
        copyToClipboard(text)
        console.log('The JSON above is on the clipboard.')
      } catch {
        console.log('Copy the JSON above by hand: the clipboard copy failed.')
      }
    }
    console.log(`Stable ID for planning/phase0/.env: ${secrets.stableId || 'not found'}`)
  }

  try {
    output.capturedAt = new Date().toISOString()
    output.page = globalThis.location.origin + globalThis.location.pathname
    output.notFound = []

    let storageKeys = []
    try {
      storageKeys = readStorageKeys()
    } catch {
      output.notFound.push('localStorage could not be read')
    }

    const { foundBy, instance } = findInstance()
    output.sdkFoundBy = foundBy
    if (!instance) {
      output.notFound.push('Statsig SDK instance')
    }

    const context = instance && typeof instance.getContext === 'function' ? instance.getContext() : undefined
    rememberUser(context?.user)

    const stable = findStableId(instance, storageKeys)
    secrets.stableId = stable.id ? String(stable.id) : ''
    output.stableIdSource = stable.source
    if (!stable.id) {
      output.notFound.push('Stable ID')
    }
    output.environmentTier = context?.options?.environment?.tier ?? null

    const values = isRecord(context?.values) ? context.values : null
    if (values) {
      output.values = { hashUsed: values.hash_used ?? null, ...describeTopLevel(values) }
      Object.assign(output.values, await checkHashes(values))
    } else {
      output.notFound.push('getContext().values')
      output.values = {
        contextKeys: isRecord(context) ? Object.keys(context) : null,
        found: false,
        instanceKeys: instance ? Object.keys(instance) : null,
      }
    }

    output.localStorage = {
      firstCachedEvaluations: describeCachedEvaluations(storageKeys, values),
      statsigKeys: storageKeys.filter((name) => name.startsWith('statsig.')),
    }
    print()
  } catch (error) {
    // Not `instanceof Error`: an error from another realm (an iframe) fails that test.
    const message = isRecord(error) && typeof error.message === 'string' ? error.message : String(error)
    console.error(`t4-sdk-snippet stopped early: ${message}. The JSON below is what it had so far.`)
    output.error = message
    print()
  }
})()
