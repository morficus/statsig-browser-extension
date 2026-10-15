import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'

import { STATSIG_API_VERSION, isAllowedApiRequest } from '@/src/lib/api-config'
import { apiKeyStorage, apiKeyTypeStorage } from '@/src/lib/storage'

interface ApiRequestMessage {
  type: string
  config?: {
    url: string
    method?: string
    body?: string
    headers?: Record<string, string>
  }
}

const REFUSED_RESPONSE = {
  error: "This request isn't allowed by Intake Experiment Testing.",
  success: false,
}

const READ_ONLY_KEY_RESPONSE = {
  error: 'Read-only key. Add a key with write access to change overrides.',
  success: false,
}

// The only caller headers that reach the Console API. The key and version are handled below.
const FORWARDED_HEADERS = new Set(['accept', 'content-type', 'statsig-api-key', 'statsig-api-version'])

const buildOutgoingHeaders = (headers: Record<string, string> | undefined, apiKey: string | null) => {
  const outgoing = Object.fromEntries(
    Object.entries(headers ?? {}).filter(([name]) => FORWARDED_HEADERS.has(name.toLowerCase())),
  )
  if (apiKey && !new Headers(outgoing).has('STATSIG-API-KEY')) {
    // Remove quotes if present (legacy support)
    outgoing['STATSIG-API-KEY'] = apiKey.replaceAll('"', '')
  }
  if (!new Headers(outgoing).has('STATSIG-API-VERSION')) {
    outgoing['STATSIG-API-VERSION'] = STATSIG_API_VERSION
  }
  return outgoing
}

const isApiRequestMessage = (msg: unknown): msg is ApiRequestMessage =>
  typeof msg === 'object' && msg !== null && 'type' in msg

export default defineBackground(() => {
  // Listen for API requests from the popup/options pages
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isApiRequestMessage(message) || message.type !== 'API_REQUEST' || !message.config) {
      return false
    }

    const { url, method, body, headers } = message.config

    // Only the extension's own pages may use the key. Content scripts run with a web page's URL.
    // Refuse before touching the key: it may only ever reach the Console API, and only for allowed calls.
    if (!sender.url?.startsWith(browser.runtime.getURL('/')) || !isAllowedApiRequest(method, url)) {
      sendResponse(REFUSED_RESPONSE)
      return false
    }

    const httpMethod = (method ?? 'GET').toUpperCase()

    const performFetch = async () => {
      const apiKey = await apiKeyStorage.getValue()

      fetch(url, {
        body,
        headers: buildOutgoingHeaders(headers, apiKey),
        method: httpMethod,
        // A redirect must never carry the key to another host.
        redirect: 'error',
      })
        .then(async (response) => {
          const responseData = await response.text().then((text) => {
            try {
              return JSON.parse(text)
            } catch {
              return text
            }
          })

          const responseHeaders: Record<string, string> = {}
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value
          })

          sendResponse({
            response: {
              data: responseData,
              headers: responseHeaders,
              ok: response.ok,
              status: response.status,
              statusText: response.statusText,
              url: response.url,
            },
            success: true,
          })
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Network error'
          sendResponse({
            error: errorMessage,
            success: false,
          })
        })
    }

    void (async () => {
      // Writes need a key with write access; reads never wait on the key type.
      if (httpMethod !== 'GET' && (await apiKeyTypeStorage.getValue()) === 'read-key') {
        sendResponse(READ_ONLY_KEY_RESPONSE)
        return
      }
      await performFetch()
    })()

    // Keep the message channel open until the async sendResponse above fires.
    return true
  })
})
