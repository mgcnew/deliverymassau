'use client'

import { useActionState, useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { criarCategoria, type FormState } from './actions'

export function NovaCategoria() {
  const [state, action, pending] = useActionState<FormState, FormData>(criarCategoria, {})
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) form.current?.reset()
  }, [state.ok])

  return (
    <form ref={form} action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="name" placeholder="Nova categoria" required className="flex-1" />
        <Button type="submit" disabled={pending}>
          {pending ? '...' : 'Criar'}
        </Button>
      </div>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
    </form>
  )
}
