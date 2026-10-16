import type { ClassValue } from 'clsx'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR = 500

const KEY_NOT_VALID_MESSAGE = 'The Console Key is not valid. Check the key, then try again.'
const READ_ONLY_KEY_MESSAGE = 'Read-only key. Add a key with write access to change overrides.'
const NETWORK_ERROR_MESSAGE = 'Cannot reach Statsig. Check your network connection, then try again.'

const ERROR_MESSAGES: Record<number, string> = {
  [HTTP_FORBIDDEN]: 'The Console Key is not allowed to do this. Ask someone from engineering for help.',
  [HTTP_NOT_FOUND]: 'The requested resource was not found.',
  [HTTP_TOO_MANY_REQUESTS]: 'Too many requests to Statsig right now. Wait a few minutes, then try again.',
}

// A read-only key's write gets a 401 with a JSON `message` that says so. A bad key gets a plain-text 401 (WL-055).
const READ_ONLY_PATTERN = /read[\s-]?only/iu

/**
 * The background script found no network: its `fetch` rejected. `src/lib/fetcher.ts` throws this error,
 * so `handleApiError` can tell "no network" from other background failures.
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

// Statsig's 401 body echoes the key ("... Key: console-xxx"), and wretch uses the raw body as `error.message`.
const CONSOLE_KEY_PATTERN = /console-[\w-]+/gu

function redactConsoleKeys(message: string): string {
  return message.replaceAll(CONSOLE_KEY_PATTERN, 'console-…')
}

function isReadOnlyKeyBody(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const { message } = data as { message?: unknown }
  return typeof message === 'string' && READ_ONLY_PATTERN.test(message)
}

function getPayloadMessage(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object') {
    const data = payload as { message?: string; error?: string }
    const payloadMessage = data.message ?? data.error
    return typeof payloadMessage === 'string' ? redactConsoleKeys(payloadMessage) : undefined
  }
  return undefined
}

function getErrorMessageFromResponse(response: { status: number; data?: unknown }): string | undefined {
  const { status } = response

  if (status === HTTP_UNAUTHORIZED) {
    return isReadOnlyKeyBody(response.data) ? READ_ONLY_KEY_MESSAGE : KEY_NOT_VALID_MESSAGE
  }

  if (status in ERROR_MESSAGES) {
    return ERROR_MESSAGES[status]
  }

  if (status >= HTTP_SERVER_ERROR) {
    return 'Server error. Please try again later.'
  }

  return getPayloadMessage(response.data)
}

function isWretchError(
  error: unknown,
): error is { response: Response & { _data?: unknown }; status: number; message: string } {
  return Boolean(error && typeof error === 'object' && 'response' in error)
}

/**
 * Handle API errors and return a user-friendly message
 * @param error - The error object
 * @returns Error message string
 */
export function handleApiError(error: unknown): string {
  if (error instanceof NetworkError) {
    return NETWORK_ERROR_MESSAGE
  }

  if (isWretchError(error)) {
    // The status decides, even when the body is empty, undefined, or plain text.
    const msg = getErrorMessageFromResponse({ data: error.response._data, status: error.status })
    if (msg) {
      return msg
    }
    return redactConsoleKeys(error.message)
  }

  if (error instanceof Error) {
    return redactConsoleKeys(error.message)
  }

  return 'An unknown error occurred'
}
