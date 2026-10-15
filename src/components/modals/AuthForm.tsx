import type { ControllerRenderProps } from 'react-hook-form'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { KeyTypeSelect } from '@/src/components/sheets/settings/AddProjectForm'
import { Button } from '@/src/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/src/components/ui/form'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { initialLogin } from '@/src/handlers/initial-login'
import { useAddProject } from '@/src/hooks/use-projects'
import { PERSONAL_KEY_GUIDANCE } from '@/src/lib/projects'
import { handleApiError } from '@/src/lib/utils'

const authSchema = z.object({
  apiKey: z.string().min(1, 'Please enter an API key').startsWith('console-', 'API key should start with "console-"'),
  apiKeyType: z.enum(['write-key', 'read-key']),
})

type AuthFormValues = z.infer<typeof authSchema>

interface AuthFormProps {
  onSuccess: () => void
}

export function AuthForm({ onSuccess }: Readonly<AuthFormProps>) {
  const addProject = useAddProject()
  const queryClient = useQueryClient()

  const form = useForm<AuthFormValues>({
    defaultValues: {
      apiKey: '',
      apiKeyType: 'write-key',
    },
    resolver: zodResolver(authSchema),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: initialLogin,
    onError: (error) => {
      form.setError('apiKey', {
        message: handleApiError(error),
        type: 'manual',
      })
    },
    onSuccess: (data, variables) => {
      if (data.error) {
        form.setError('apiKey', { message: data.error, type: 'manual' })
        return
      }

      if (data.success) {
        void addProject(variables, false, form.getValues('apiKeyType'))
        void queryClient.invalidateQueries()
        onSuccess()
      }
    },
  })

  const onSubmit = useCallback(
    (values: AuthFormValues) => {
      mutate(values.apiKey)
    },
    [mutate],
  )

  const handleFormSubmit = useCallback(
    (event: React.ComponentProps<'form'>['onSubmit'] extends (event: infer T) => unknown ? T : never) => {
      void form.handleSubmit(onSubmit)(event)
    },
    [form, onSubmit],
  )

  const renderApiKeyField = useCallback(
    ({ field }: { field: ControllerRenderProps<AuthFormValues, 'apiKey'> }) => (
      <FormItem>
        <FormLabel>Statsig Console API Key</FormLabel>
        <FormControl>
          <Input placeholder="console-..." {...field} disabled={isPending} />
        </FormControl>
        <p className="text-xs text-muted-foreground">{PERSONAL_KEY_GUIDANCE}</p>
        <FormMessage />
      </FormItem>
    ),
    [isPending],
  )

  const renderKeyTypeField = useCallback(
    ({ field }: { field: ControllerRenderProps<AuthFormValues, 'apiKeyType'> }) => (
      <FormItem>
        <Label htmlFor="auth-key-type">Key type</Label>
        <KeyTypeSelect id="auth-key-type" value={field.value} onChange={field.onChange} disabled={isPending} />
      </FormItem>
    ),
    [isPending],
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>Login to Statsig</DialogTitle>
        <DialogDescription className="pt-2 text-justify">
          Before you can use this extension, you need to login to your Statsig account. This can be done with a{' '}
          <b>Read Only Statsig Console API Key</b>. This key can be created in the <b>Project Settings</b> under the{' '}
          <a
            href="https://console.statsig.com/api_keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center font-medium text-primary hover:underline"
          >
            Keys & Environments <ExternalLink className="ml-0.5 h-3 w-3" />
          </a>{' '}
          tab.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={handleFormSubmit} className="space-y-4 py-4">
          <FormField control={form.control} name="apiKey" render={renderApiKeyField} />
          <FormField control={form.control} name="apiKeyType" render={renderKeyTypeField} />

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
