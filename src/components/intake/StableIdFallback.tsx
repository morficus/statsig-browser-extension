import { TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import type { TesterStableId } from '@/src/hooks/use-tester-stable-id'

import { Button } from '@/src/components/ui/button'
import { CopyableText } from '@/src/components/ui/copyable-text'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { useTesterStableId } from '@/src/hooks/use-tester-stable-id'
import { validateManualStableId } from '@/src/lib/manual-stable-id'
import { handleApiError } from '@/src/lib/utils'

type FieldError = 'empty' | 'save' | 'whitespace'

const ERROR_MESSAGES: Record<FieldError, string> = {
  empty: 'Enter a Stable ID.',
  save: "The Stable ID wasn't saved. Try again.",
  whitespace: "A Stable ID can't contain spaces.",
}

const CLEAR_ERROR_MESSAGE = "The Stable ID wasn't cleared. Try again."

/** Where focus goes after an action moves the Tester to the other view. */
type FocusTarget = 'clear' | 'input'

/**
 * Lets an action ask the view it leads to for focus. The request is dropped if the action fails,
 * and the view that takes it clears it, so a later mount (a refetch, a tab change) does not steal focus.
 */
function useFocusRequest() {
  const requested = useRef<FocusTarget | null>(null)

  const run = useCallback(async (target: FocusTarget, action: () => Promise<void>) => {
    requested.current = target
    try {
      await action()
    } catch (error) {
      requested.current = null
      throw error
    }
  }, [])

  const take = useCallback((target: FocusTarget) => {
    const isRequested = requested.current === target
    if (isRequested) {
      requested.current = null
    }
    return isRequested
  }, [])

  return { run, take }
}

type FocusRequest = ReturnType<typeof useFocusRequest>

/** Moves focus to `element` when the view mounts, but only if an action asked for it. */
function useFocusOnMount(request: FocusRequest, target: FocusTarget, element: React.RefObject<HTMLElement | null>) {
  const { take } = request

  useEffect(() => {
    if (take(target)) {
      element.current?.focus()
    }
  }, [element, take, target])
}

function StableIdAlert({
  isRefetching,
  onRetry,
}: Readonly<{ isRefetching: boolean; onRetry: TesterStableId['refetch'] }>) {
  const handleRetry = useCallback(() => {
    void onRetry()
  }, [onRetry])

  return (
    <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-4 shrink-0 text-destructive" />
        <p className="font-medium">Stable ID not found</p>
      </div>
      <p className="mt-1">
        The extension can&apos;t read your Stable ID from this page. Reload the page and try again, or enter your Stable
        ID below.
      </p>
      <div className="mt-2 flex justify-end">
        <Button type="button" variant="outline" size="sm" disabled={isRefetching} onClick={handleRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

function useStableIdForm(
  onSave: TesterStableId['saveManualStableId'],
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<FieldError | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const isSavingRef = useRef(false)

  const fail = useCallback(
    (reason: FieldError) => {
      setError(reason)
      inputRef.current?.focus()
    },
    [inputRef],
  )

  const persist = useCallback(
    async (value: string) => {
      isSavingRef.current = true
      setIsSaving(true)
      try {
        await onSave(value)
        return true
      } catch {
        return false
      } finally {
        isSavingRef.current = false
        setIsSaving(false)
      }
    },
    [onSave],
  )

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value)
    setError(undefined)
  }, [])

  const save = useCallback(async () => {
    // The button is disabled while a save runs, but a second submit can still arrive before it re-renders.
    if (isSavingRef.current) {
      return
    }

    const result = validateManualStableId(input)
    if (!result.ok) {
      fail(result.reason)
      return
    }

    if (!(await persist(result.value))) {
      fail('save')
    }
  }, [fail, input, persist])

  const handleSubmit = useCallback(
    (event: React.SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()
      void save()
    },
    [save],
  )

  return { error, handleChange, handleSubmit, input, isSaving }
}

function StableIdForm({
  focusRequest,
  onSave,
}: Readonly<{ focusRequest: FocusRequest; onSave: TesterStableId['saveManualStableId'] }>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = useId()
  const { error, handleChange, handleSubmit, input, isSaving } = useStableIdForm(onSave, inputRef)
  useFocusOnMount(focusRequest, 'input', inputRef)

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <Label htmlFor={inputId}>Stable ID</Label>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          id={inputId}
          value={input}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error === 'empty' || error === 'whitespace' ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={handleChange}
        />
        <Button type="submit" disabled={isSaving}>
          Use this ID
        </Button>
      </div>
      <p id={errorId} aria-live="polite" className="text-xs text-destructive empty:mb-0">
        {error ? ERROR_MESSAGES[error] : null}
      </p>
      <p className="text-xs text-muted-foreground">
        To find it, open DevTools &gt; Application &gt; Local Storage. Copy the value of the key that starts with{' '}
        <code>statsig.stable_id.</code>.
      </p>
    </form>
  )
}

function ManualStableIdInUse({
  focusRequest,
  manualStableId,
  onClear,
}: Readonly<{
  focusRequest: FocusRequest
  manualStableId: string
  onClear: TesterStableId['clearManualStableId']
}>) {
  const [hasClearError, setHasClearError] = useState(false)
  const clearRef = useRef<HTMLButtonElement>(null)
  useFocusOnMount(focusRequest, 'clear', clearRef)

  const handleClear = useCallback(() => {
    setHasClearError(false)
    onClear().catch((error: unknown) => {
      console.error('[Intake Experiment Testing] Failed to clear the Stable ID:', handleApiError(error))
      setHasClearError(true)
    })
  }, [onClear])

  return (
    <div className="space-y-2">
      <p className="text-sm">Using the Stable ID you entered.</p>
      <div>
        <div className="flex items-center justify-between gap-2">
          <CopyableText value={manualStableId} valueClassName="font-mono text-sm break-all" />
          <Button ref={clearRef} type="button" variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
        </div>
        <p aria-live="polite" className="mt-1 text-xs text-destructive empty:mt-0">
          {hasClearError ? CLEAR_ERROR_MESSAGE : null}
        </p>
      </div>
    </div>
  )
}

/**
 * Shown on an Intake tab when the page read finds no Stable ID (REQ-OVR-005).
 * The Tester can type the ID in. A detected ID always wins, so this renders nothing when one is found.
 */
export function StableIdFallback() {
  const { clearManualStableId, isLoading, isMissing, isRefetching, manualStableId, refetch, saveManualStableId } =
    useTesterStableId()
  const focusRequest = useFocusRequest()
  const { run } = focusRequest

  const handleSave = useCallback(
    (value: string) => run('clear', () => saveManualStableId(value)),
    [run, saveManualStableId],
  )

  const handleClear = useCallback(() => run('input', clearManualStableId), [clearManualStableId, run])

  if (isLoading || !isMissing) {
    return null
  }

  if (manualStableId !== undefined) {
    return <ManualStableIdInUse focusRequest={focusRequest} manualStableId={manualStableId} onClear={handleClear} />
  }

  return (
    <div className="space-y-3">
      <StableIdAlert isRefetching={isRefetching} onRetry={refetch} />
      <StableIdForm focusRequest={focusRequest} onSave={handleSave} />
    </div>
  )
}
