import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import React, { useCallback, useState } from 'react'

import type { ApiKeyType } from '@/src/lib/projects'

import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { initialLogin } from '@/src/handlers/initial-login'
import { useAddProject } from '@/src/hooks/use-projects'
import { isApiKeyType, KEY_TYPE_OPTIONS, PERSONAL_KEY_GUIDANCE } from '@/src/lib/projects'
import { handleApiError } from '@/src/lib/utils'
import { useSettingsStore } from '@/src/store/use-settings-store'

interface KeyTypeSelectProps {
  id: string
  value: ApiKeyType
  onChange: (value: ApiKeyType) => void
  disabled?: boolean
  className?: string
}

/** Picks whether a Console Key may change things in Statsig; used wherever a key is added or edited. */
export function KeyTypeSelect({ className, disabled, id, onChange, value }: Readonly<KeyTypeSelectProps>) {
  const handleValueChange = useCallback(
    (next: string) => {
      if (isApiKeyType(next)) {
        onChange(next)
      }
    },
    [onChange],
  )

  return (
    <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {KEY_TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface AddProjectFormProps {
  /** Pin the inspected site to the new project, so the extension keeps using it there. */
  pinOrigin?: boolean
}

/** Checks the key with Statsig, then adds it as a project of the given key type. */
const useLoginAndAddProject = ({
  apiKeyType,
  onAdded,
  onError,
  pinOrigin,
}: {
  apiKeyType: ApiKeyType
  onAdded: () => void
  onError: (message: string) => void
  pinOrigin: boolean
}) => {
  const addProject = useAddProject()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: initialLogin,
    onError: (mutationError) => {
      onError(handleApiError(mutationError))
    },
    onSuccess: (data, variables) => {
      if (!data.success || data.error) {
        onError(data.error ?? 'The API key was rejected by Statsig')
        return
      }

      onAdded()
      void addProject(variables, pinOrigin, apiKeyType).then(() => queryClient.invalidateQueries())
    },
  })
}

export function AddProjectForm({ pinOrigin = false }: Readonly<AddProjectFormProps>) {
  const projects = useSettingsStore((state) => state.projects)

  const [apiKey, setApiKey] = useState('')
  const [apiKeyType, setApiKeyType] = useState<ApiKeyType>('write-key')
  const [error, setError] = useState<string>()

  const clearApiKey = useCallback(() => {
    setApiKey('')
  }, [])
  const { isPending, mutate } = useLoginAndAddProject({
    apiKeyType,
    onAdded: clearApiKey,
    onError: setError,
    pinOrigin,
  })

  const handleApiKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(event.target.value)
    setError(undefined)
  }, [])

  const handleAdd = useCallback(() => {
    const value = apiKey.trim()
    if (!value.startsWith('console-')) {
      setError('API key should start with "console-"')
      return
    }
    /* In the page gate, entering a configured key again means "this site is that project", which
     * pins the site instead of being rejected. */
    if (!pinOrigin && projects.some((project) => project.apiKey === value)) {
      setError('That project is already configured')
      return
    }
    mutate(value)
  }, [apiKey, mutate, pinOrigin, projects])

  // The settings sheet is already a form, so Enter must add the key instead of saving the settings.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleAdd()
      }
    },
    [handleAdd],
  )

  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">Add project</Label>
      <div className="flex items-start gap-2">
        <Input
          value={apiKey}
          onChange={handleApiKeyChange}
          onKeyDown={handleKeyDown}
          placeholder="console-..."
          disabled={isPending}
          aria-label="Statsig Console API Key"
        />
        <Button type="button" variant="outline" onClick={handleAdd} disabled={isPending} className="gap-1">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{PERSONAL_KEY_GUIDANCE}</p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <Label htmlFor="add-project-key-type" className="text-sm font-medium">
          Key type
        </Label>
        <KeyTypeSelect
          id="add-project-key-type"
          value={apiKeyType}
          onChange={setApiKeyType}
          disabled={isPending}
          className="w-[140px]"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
