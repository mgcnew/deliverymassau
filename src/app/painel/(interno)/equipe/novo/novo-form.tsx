'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { criarFuncionario, type FormState } from '../actions'

export function NovoFuncionarioForm({
  presets,
}: {
  presets: Array<{ id: string; name: string; description: string | null }>
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(criarFuncionario, {})

  return (
    <form action={action} className="space-y-4">
      <Field label="Nome">
        <Input name="name" required autoFocus />
      </Field>
      <Field label="Telefone / WhatsApp">
        <Input name="phone" inputMode="tel" placeholder="(00) 00000-0000" />
      </Field>
      <Field label="E-mail de acesso">
        <Input name="email" type="email" required />
      </Field>
      <Field label="Senha inicial" hint="A pessoa podera trocar depois. Minimo de 8 caracteres.">
        <Input name="password" type="password" required minLength={8} />
      </Field>
      <Field label="Perfil base" hint="Voce ajusta as permissoes individualmente na tela seguinte.">
        <Select name="preset_id" required defaultValue="">
          <option value="" disabled>
            Escolha...
          </option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Cadastrando...' : 'Cadastrar funcionario'}
      </Button>
    </form>
  )
}
