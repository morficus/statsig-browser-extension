/* This file is one self-contained function injected into the page, so every helper has to be
 * declared inside it and the usual size and scoping rules cannot apply. */
// oxlint-disable no-inner-declarations, max-statements, max-lines-per-function, unicorn/consistent-function-scoping
import type { DetectedStatsigKeys } from '../lib/projects'
import type { PageStableId, StatsigInstance, WindowWithStatsig } from '../types/statsig'

/** What the page reader returns. `context`, `keys`, and the tier are left out when the page has no SDK instance. */
interface PageReadResult {
  href: string
  user: Record<string, unknown>
  context?: Record<string, unknown> | undefined
  keys?: DetectedStatsigKeys
  stableId?: PageStableId
  environmentTier?: string
}

/**
 * Reads the Statsig state of the page. Injected verbatim by `scripting.executeScript`, which
 * serializes this function on its own: every helper it uses has to live inside it, imports and
 * module-level values are not available in the page.
 */
export const getUserDetailsFromPage = (): PageReadResult | null => {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const win = globalThis as unknown as WindowWithStatsig
    const CLIENT_KEY_PREFIX = 'client-'
    const CACHED_EVALUATIONS_PREFIX = 'statsig.cached.evaluations.'
    // The number at the end of the key changes, so only the prefix is ever matched.
    const STABLE_ID_PREFIX = 'statsig.stable_id.'

    function isRecord(value: unknown): value is Record<string, unknown> {
      return typeof value === 'object' && value !== null
    }

    /** Statsig's DJB2 variant. Kept in sync with `src/lib/djb2.ts`, which cannot be imported here. */
    function hashName(value: string) {
      const DJB2_MULTIPLIER = 31
      let hash = 0
      for (let index = 0; index < value.length; index++) {
        // oxlint-disable-next-line unicorn/prefer-code-point -- Statsig hashes UTF-16 code units
        hash = Math.imul(hash, DJB2_MULTIPLIER) + value.charCodeAt(index) // NOSONAR: code units, not code points
      }
      return String(hash >>> 0)
    }

    function collectSdkKeys(context: Record<string, unknown> | undefined) {
      const keys = new Set<string>()

      // Every instance map is keyed by the client SDK key that created it.
      for (const instances of [
        win.__STATSIG__?.instances,
        win.__STATSIG__?.srInstances,
        win.__STATSIG__?.acInstances,
      ]) {
        for (const key of Object.keys(instances ?? {})) {
          if (key.startsWith(CLIENT_KEY_PREFIX)) {
            keys.add(key)
          }
        }
      }

      const contextKey = context?.sdkKey
      if (typeof contextKey === 'string' && contextKey.startsWith(CLIENT_KEY_PREFIX)) {
        keys.add(contextKey)
      }

      return [...keys]
    }

    /** Evaluation payloads cached by the SDK, the only source left on bootstrapped pages. */
    function readCachedPayloads() {
      const payloads: Record<string, unknown>[] = []

      try {
        for (let index = 0; index < globalThis.localStorage.length; index++) {
          const key = globalThis.localStorage.key(index)
          if (key?.startsWith(CACHED_EVALUATIONS_PREFIX)) {
            const entry: unknown = JSON.parse(globalThis.localStorage.getItem(key) ?? 'null')
            const data: unknown = isRecord(entry) && typeof entry.data === 'string' ? JSON.parse(entry.data) : undefined
            if (isRecord(data)) {
              payloads.push(data)
            }
          }
        }
      } catch {
        // Storage unavailable or malformed entry: keep whatever was collected
      }

      return payloads
    }

    function collectPayloadKeys(payloads: Record<string, unknown>[]) {
      const hashedSdkKeys = new Set<string>()
      const gateHashes = new Set<string>()

      for (const payload of payloads) {
        if (typeof payload.hashed_sdk_key_used === 'string') {
          hashedSdkKeys.add(payload.hashed_sdk_key_used)
        }

        const gates = payload.feature_gates
        const hashUsed = payload.hash_used
        // Unhashed payloads expose plain gate names, so hash them to compare against the Console API.
        if (isRecord(gates) && (hashUsed === 'djb2' || hashUsed === 'none')) {
          for (const gate of Object.keys(gates)) {
            gateHashes.add(hashUsed === 'none' ? hashName(gate) : gate)
          }
        }
      }

      return { gateHashes: [...gateHashes], hashedSdkKeys: [...hashedSdkKeys] }
    }

    function collectKeys(context: Record<string, unknown> | undefined): DetectedStatsigKeys | undefined {
      const values = isRecord(context?.values) ? context.values : undefined
      const { gateHashes, hashedSdkKeys } = collectPayloadKeys([...(values ? [values] : []), ...readCachedPayloads()])
      const sdkKeys = collectSdkKeys(context)

      if (sdkKeys.length === 0 && hashedSdkKeys.length === 0 && gateHashes.length === 0) {
        return undefined
      }

      return { gateHashes, hashedSdkKeys, sdkKeys }
    }

    // oxlint-disable-next-line unicorn/consistent-function-scoping
    function getUser(instance: StatsigInstance) {
      if (!instance) {
        return null
      }

      // Try getCurrentUser()
      if (typeof instance.getCurrentUser === 'function') {
        return instance.getCurrentUser()
      }

      // Try internal properties
      if (instance._user) {
        return instance._user
      }
      if (instance.identity?.user) {
        return instance.identity.user
      }

      return null
    }

    /** Runs one SDK read. A throwing accessor counts as "nothing found", so it cannot lose the whole result. */
    function attempt<T>(read: () => T): T | undefined {
      try {
        return read()
      } catch {
        return undefined
      }
    }

    /** A step gives an ID only if it reads a string that is not blank. The trimmed value is the ID. */
    function readUsableStableID(read: () => unknown) {
      const value = attempt(read)
      const trimmed = typeof value === 'string' ? value.trim() : ''

      return trimmed === '' ? null : trimmed
    }

    function getStableID(instance: StatsigInstance) {
      const steps: (() => unknown)[] = [
        // 1. Try instance.getStableID()
        () => (typeof instance.getStableID === 'function' ? instance.getStableID() : undefined),
        // 2. Try instance.getContext().stableID
        () => (typeof instance.getContext === 'function' ? instance.getContext()?.stableID : undefined),
        // 3. Fallback: window.__STATSIG__.firstInstance.getContext()
        // This is specifically requested by the user for React SDK scenarios
        () => {
          const firstInstance = win.__STATSIG__?.firstInstance
          return typeof firstInstance?.getContext === 'function' ? firstInstance.getContext()?.stableID : undefined
        },
        // 4. Fallback: instance properties
        () => instance._stableID,
        () => instance.identity?.stableID,
      ]

      for (const step of steps) {
        const stableID = readUsableStableID(step)
        if (stableID) {
          return stableID
        }
      }

      return null
    }

    /** The JS SDK stores the ID as a JSON string. A raw value is used as it is. */
    function parseStoredStableId(raw: string | null) {
      if (raw === null) {
        return null
      }

      let parsed: unknown = raw
      try {
        parsed = JSON.parse(raw)
      } catch {
        // Not JSON: use the raw value
      }

      if (typeof parsed !== 'string') {
        return null
      }

      const value = parsed.trim()
      return value === '' ? null : value
    }

    /** First `statsig.stable_id.*` key, in index order, that holds a usable value. Never reads cookies. */
    function readLocalStorageStableId() {
      try {
        for (let index = 0; index < globalThis.localStorage.length; index++) {
          const key = globalThis.localStorage.key(index)
          if (key?.startsWith(STABLE_ID_PREFIX)) {
            const value = parseStoredStableId(globalThis.localStorage.getItem(key))
            if (value) {
              return value
            }
          }
        }
      } catch {
        // Storage blocked or sandboxed: there is no localStorage Stable ID
      }

      return null
    }

    /** The SDK instance lookups come first. localStorage is read only when none of them gives an ID. */
    function findStableId(instance: StatsigInstance): PageStableId | undefined {
      const sdkStableID = getStableID(instance)
      if (sdkStableID) {
        return { source: 'sdk', value: sdkStableID }
      }

      const storedStableID = readLocalStorageStableId()
      return storedStableID ? { source: 'localStorage', value: storedStableID } : undefined
    }

    function readEnvironmentTier(context: Record<string, unknown> | undefined) {
      const options = isRecord(context) ? context.options : undefined
      const environment = isRecord(options) ? options.environment : undefined
      const tier = isRecord(environment) ? environment.tier : undefined

      return typeof tier === 'string' && tier !== '' ? tier : undefined
    }

    function getStatsigInstance() {
      // 1. Check window.statsig (JS SDK)
      if (win.statsig) {
        if (typeof win.statsig.getCurrentUser === 'function') {
          return win.statsig
        }
        // Fallback for JS SDK instance properties
        if (win.statsig._user || win.statsig.identity) {
          return win.statsig
        }
      }

      // 2. Check window.__STATSIG__ (React SDK / multiple instances)
      if (win.__STATSIG__) {
        // Check instances map
        if (win.__STATSIG__.instances) {
          const instances = Object.values(win.__STATSIG__.instances)
          if (instances.length > 0) {
            return instances[0]
          }
        }
        // Check firstInstance
        if (win.__STATSIG__.firstInstance) {
          return win.__STATSIG__.firstInstance
        }
      }

      // 3. Check window.__STATSIG_JS_SDK__
      if (win.__STATSIG_JS_SDK__?.instance) {
        return win.__STATSIG_JS_SDK__.instance
      }

      return null
    }

    // Page code can replace `globalThis` (`globalThis = {...}`), but it cannot replace `window.location`.
    // The handler trusts this href to tell which page the script ran on.
    // oxlint-disable-next-line unicorn/prefer-global-this
    const { href } = window.location
    const instance = attempt(getStatsigInstance) ?? null

    if (!instance) {
      const storedStableID = readLocalStorageStableId()
      if (!storedStableID) {
        return null
      }

      const stableId: PageStableId = { source: 'localStorage', value: storedStableID }
      return { href, stableId, user: { stableID: storedStableID } }
    }

    const user = attempt(() => getUser(instance)) ?? {}
    const stableId = findStableId(instance)

    if (stableId) {
      user.stableID = stableId.value
    }

    // None of these may lose the Stable ID found above, so a throwing accessor only drops its own field.
    const context = attempt(() => (typeof instance.getContext === 'function' ? instance.getContext() : undefined))
    const keys = attempt(() => collectKeys(context))
    const environmentTier = attempt(() => readEnvironmentTier(context))

    return {
      context,
      ...(environmentTier !== undefined && { environmentTier }),
      href,
      ...(keys && { keys }),
      ...(stableId && { stableId }),
      user,
    }
  } catch {
    // Ignore errors to prevent crashing the extension
  }

  return null
}
