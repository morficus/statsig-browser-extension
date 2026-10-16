import { TriangleAlert } from 'lucide-react'
import { useCallback, useId, useState } from 'react'

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

function StableIdForm({ onSave }: Readonly<{ onSave: TesterStableId['saveManualStableId'] }>) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<FieldError | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const inputId = useId()
  const errorId = useId()

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value)
    setError(undefined)
  }, [])

  const save = useCallback(async () => {
    const result = validateManualStableId(input)
    if (!result.ok) {
      setError(result.reason)
      return
    }

    setIsSaving(true)
    try {
      await onSave(result.value)
    } catch {
      setError('save')
    } finally {
      setIsSaving(false)
    }
  }, [input, onSave])

  const handleSubmit = useCallback(
    (event: React.SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()
      void save()
    },
    [save],
  )

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <Label htmlFor={inputId}>Stable ID</Label>
      <div className="flex items-center gap-2">
        <Input
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
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {ERROR_MESSAGES[error]}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        To find it, open DevTools &gt; Application &gt; Local Storage. Copy the value of the key that starts with{' '}
        <code>statsig.stable_id.</code>.
      </p>
    </form>
  )
}

function ManualStableIdInUse({
  manualStableId,
  onClear,
}: Readonly<{ manualStableId: string; onClear: TesterStableId['clearManualStableId'] }>) {
  const [hasClearError, setHasClearError] = useState(false)

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
      <div className="flex items-center justify-between gap-2">
        <CopyableText value={manualStableId} valueClassName="font-mono text-sm break-all" />
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          Clear
        </Button>
      </div>
      {hasClearError && <p className="text-xs text-destructive">{CLEAR_ERROR_MESSAGE}</p>}
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

  if (isLoading || !isMissing) {
    return null
  }

  if (manualStableId !== undefined) {
    return <ManualStableIdInUse manualStableId={manualStableId} onClear={clearManualStableId} />
  }

  return (
    <div className="space-y-3">
      <StableIdAlert isRefetching={isRefetching} onRetry={refetch} />
      <StableIdForm onSave={saveManualStableId} />
    </div>
  )
}
