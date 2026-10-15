import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { apiKeyTypeStorage } from '@/src/lib/storage'

import { READ_ONLY_KEY_REASON, useWriteAccess } from './use-write-access'

describe('useWriteAccess', () => {
  it('denies write access without a reason while the key type is loading', () => {
    const { result } = renderHook(() => useWriteAccess())

    expect(result.current).toStrictEqual({ canWrite: false, reason: null })
  })

  it('allows writes with a write key', async () => {
    await apiKeyTypeStorage.setValue('write-key')

    const { result } = renderHook(() => useWriteAccess())

    await waitFor(() => {
      expect(result.current).toStrictEqual({ canWrite: true, reason: null })
    })
  })

  it('denies writes with a read key and gives the reason', async () => {
    await apiKeyTypeStorage.setValue('read-key')

    const { result } = renderHook(() => useWriteAccess())

    await waitFor(() => {
      expect(result.current).toStrictEqual({ canWrite: false, reason: READ_ONLY_KEY_REASON })
    })
  })

  it('follows the key type when it changes', async () => {
    await apiKeyTypeStorage.setValue('write-key')
    const { result } = renderHook(() => useWriteAccess())
    await waitFor(() => {
      expect(result.current.canWrite).toBeTruthy()
    })

    await apiKeyTypeStorage.setValue('read-key')

    await waitFor(() => {
      expect(result.current.canWrite).toBeFalsy()
    })
  })
})
