import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'

import { STATSIG_API_VERSION, isAllowedApiUrl } from '@/src/lib/api-config'
import { apiKeyStorage } from '@/src/lib/storage'

interface ApiRequestMessage {
  type: string
  config?: {
    url: string
    method?: string
    body?: string
    headers?: Record<string, string>
  }
}

const isApiRequestMessage = (msg: unknown): msg is ApiRequestMessage =>
  typeof msg === 'object' && msg !== null && 'type' in msg

export default defineBackground(() => {
  // Listen for API requests from the popup/options pages
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isApiRequestMessage(message) || message.type !== 'API_REQUEST' || !message.config) {
      return false
    }

    const { url, method, body, headers } = message.config

    // Refuse before touching the key: the Console Key may only ever reach the Console API.
    if (!isAllowedApiUrl(url)) {
      sendResponse({
        error: "This request isn't allowed by Intake Experiment Testing.",
        success: false,
      })
      return false
    }

    // Perform the fetch request
    void apiKeyStorage.getValue().then((apiKey: string | null) => {
      const finalHeaders = { ...headers }
      if (apiKey && !new Headers(finalHeaders).has('STATSIG-API-KEY')) {
        // Remove quotes if present (legacy support)
        finalHeaders['STATSIG-API-KEY'] = apiKey.replaceAll('"', '')
      }
      if (!new Headers(finalHeaders).has('STATSIG-API-VERSION')) {
        finalHeaders['STATSIG-API-VERSION'] = STATSIG_API_VERSION
      }

      fetch(url, {
        body,
        headers: finalHeaders,
        method,
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
    })

    // Keep the message channel open until the async sendResponse above fires.
    return true
  })
})
