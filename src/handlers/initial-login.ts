import { api } from '../lib/fetcher'
import { handleApiError } from '../lib/utils'

interface InitialLoginResponse {
  data: unknown
  error?: string
  success: boolean
}

/**
 * Verifies the Statsig Console API Key by making a request to the /gates endpoint.
 *
 * @param apiKey - The Statsig Console API Key to verify
 * @returns A promise resolving to the login response indicating success or failure
 */
export const initialLogin = async (apiKey: string): Promise<InitialLoginResponse> => {
  try {
    const data = await api.headers({ 'STATSIG-API-KEY': apiKey }).url('/gates?limit=1').get().json<{ data: unknown }>()

    return {
      data: data?.data,
      error: undefined,
      success: true,
    }
  } catch (error) {
    const message = handleApiError(error)
    // Log only the sanitized message: the raw error carries the response body, which can echo the key.
    console.error('Failed to login:', message)
    return {
      data: undefined,
      error: message,
      success: false,
    }
  }
}
