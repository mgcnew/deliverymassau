'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { criarPrimeiroAdmin, type SetupState } from './actions'

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(criarPrimeiroAdmin, {})

  return (
    <form action={action} className="space-y-4">
      <Field label="Seu nome">
        <Input name="name" required autoFocus />
      </Field>
      <Field label="Telefone / WhatsApp">
        <Input name="phone" inputMode="tel" placeholder="(00) 00000-0000" />
      </Field>
      <Field label="E-mail de acesso">
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Senha" hint="Minimo de 8 caracteres.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Criando...' : 'Criar administrador'}
      </Button>
    </form>
  )
}
