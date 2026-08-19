'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { alterarAtivacao, salvarDadosFuncionario, type FormState } from '../actions'

export function DadosForm({
  id,
  name,
  phone,
  ativo,
  podeEditar,
  podeAtivar,
}: {
  id: string
  name: string
  phone: string | null
  ativo: boolean
  podeEditar: boolean
  podeAtivar: boolean
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(salvarDadosFuncionario, {})
  const [estadoAtivo, acaoAtivo, pendenteAtivo] = useActionState<FormState, FormData>(
    alterarAtivacao,
    {},
  )

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <Field label="Nome">
          <Input name="name" defaultValue={name} required disabled={!podeEditar} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <Input name="phone" defaultValue={phone ?? ''} inputMode="tel" disabled={!podeEditar} />
        </Field>

        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}

        {podeEditar ? (
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? 'Salvando...' : 'Salvar dados'}
          </Button>
        ) : null}
      </form>

      {podeAtivar ? (
        <form action={acaoAtivo} className="space-y-2 border-t border-line pt-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="ativar" value={ativo ? '0' : '1'} />
          <p className="text-sm text-muted">
            Funcionario com historico em pedidos nunca e excluido - apenas desativado.
          </p>
          {estadoAtivo.error ? <Alert tone="error">{estadoAtivo.error}</Alert> : null}
          {estadoAtivo.ok ? <Alert tone="success">{estadoAtivo.ok}</Alert> : null}
          <Button type="submit" variant={ativo ? 'danger' : 'secondary'} disabled={pendenteAtivo}>
            {ativo ? 'Desativar acesso' : 'Reativar acesso'}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
