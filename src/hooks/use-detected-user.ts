import type { Browser } from 'wxt/browser'

import { useEffect, useCallback } from 'react'
import { browser } from 'wxt/browser'

import { isIntakeSiteUrl } from '@/src/lib/intake-site'
import { getActiveIntakeTab } from '@/src/lib/tabs'
import { handleApiError } from '@/src/lib/utils'
import { useContextStore } from '@/src/store/use-context-store'

interface DetectedResponse {
  user?: Record<string, unknown>
  context?: Record<string, unknown>
  error?: string
}

interface StatsigDetectionMessage extends DetectedResponse {
  type: string
}

// The only runtime message types the listener acts on. Any other type returns before the tab query.
const DETECTION_MESSAGE_TYPES = new Set(['STATSIG_USER_FOUND', 'STATSIG_DETECTED_BUT_ERROR'])

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const parseDetectedResponse = (value: unknown): DetectedResponse | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const response: DetectedResponse = {}

  if (isRecord(value.user)) {
    response.user = value.user
  }

  if (isRecord(value.context)) {
    response.context = value.context
  }

  if (typeof value.error === 'string') {
    response.error = value.error
  }

  return response
}

const parseDetectionMessage = (value: unknown): StatsigDetectionMessage | undefined => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return undefined
  }

  return {
    ...parseDetectedResponse(value),
    type: value.type,
  }
}

export function useDetectedUser() {
  const setDetectedUser = useContextStore((state) => state.setDetectedUser)
  const setDetectedContext = useContextStore((state) => state.setDetectedContext)
  const setDetectionError = useContextStore((state) => state.setDetectionError)

  const handleResponse = useCallback(
    (response: DetectedResponse | undefined) => {
      if (response?.user) {
        setDetectedUser(response.user)
        setDetectionError(null)
      }
      if (response?.context) {
        setDetectedContext(response.context)
      }
      if (response?.error) {
        setDetectionError(response.error)
      }
    },
    [setDetectedUser, setDetectedContext, setDetectionError],
  )

  const retryDetection = useCallback(async () => {
    const tab = await getActiveIntakeTab()
    if (!tab?.id) {
      return
    }

    await browser.tabs
      .sendMessage(tab.id, { type: 'GET_STATSIG_USER' })
      .then((response: unknown) => {
        const parsed = parseDetectedResponse(response)
        handleResponse(parsed)
        // Only settle the error once the page answered: clearing it up front flashed the stale user details
        setDetectionError(parsed?.error ?? null)
      })
      .catch((error) => {
        console.error('Statsig detection error:', handleApiError(error))
        setDetectionError('Connection failed. Please refresh the page.')
      })
  }, [setDetectionError, handleResponse])

  const fetchUser = useCallback(
    async (retries = 3, delay = 100) => {
      const tab = await getActiveIntakeTab()
      const activeTabId = tab?.id

      if (activeTabId) {
        try {
          const response: unknown = await browser.tabs.sendMessage(activeTabId, {
            type: 'GET_STATSIG_USER',
          })
          handleResponse(parseDetectedResponse(response))
        } catch (error) {
          if (retries > 0) {
            setTimeout(() => {
              void fetchUser(retries - 1, delay * 2)
            }, delay)
          } else {
            console.error('Statsig detection error:', handleApiError(error))
            setDetectionError('Connection failed. Please refresh the page.')
          }
        }
      }
    },
    [handleResponse, setDetectionError],
  )

  useEffect(() => {
    // Cleared by the cleanup: a tab lookup that settles after the hook unmounts must not write to the store
    let active = true

    // Accept a message only from the tab the Tester is looking at, and only while it is an Intake Site page (WL-031)
    const isActiveIntakeSender = async (sender: Browser.runtime.MessageSender | undefined) => {
      const senderTab = sender?.tab
      if (typeof senderTab?.id !== 'number' || !isIntakeSiteUrl(senderTab.url)) {
        return false
      }

      const activeTab = await getActiveIntakeTab()
      return activeTab?.id === senderTab.id
    }

    const handleDetectionMessage = async (message: unknown, sender: Browser.runtime.MessageSender | undefined) => {
      const msg = parseDetectionMessage(message)
      // An unparseable message or another type returns before the tab query. `active` is read after that await.
      if (!msg || !DETECTION_MESSAGE_TYPES.has(msg.type) || !(await isActiveIntakeSender(sender)) || !active) {
        return
      }

      if (msg.type === 'STATSIG_USER_FOUND' && msg.user) {
        setDetectedUser(msg.user)
        if (msg.context) {
          setDetectedContext(msg.context)
        }
        setDetectionError(null)
      } else if (msg.type === 'STATSIG_DETECTED_BUT_ERROR' && msg.error) {
        setDetectionError(msg.error)
      }
    }

    // Sync on purpose: the listener never answers with sendResponse, so it must not return true or a promise
    const handleMessage = (message: unknown, sender: Browser.runtime.MessageSender) => {
      void handleDetectionMessage(message, sender)
    }
    browser.runtime.onMessage.addListener(handleMessage)

    void fetchUser()

    return () => {
      active = false
      browser.runtime.onMessage.removeListener(handleMessage)
    }
  }, [setDetectedUser, setDetectedContext, setDetectionError, fetchUser])

  return { retryDetection }
}
