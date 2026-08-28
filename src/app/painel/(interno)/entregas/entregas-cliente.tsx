'use client'

import { useState } from 'react'

import { Empty } from '@/components/ui/card'
import { useAtualizacaoAoVivo } from '../use-atualizacao-ao-vivo'
import { CardEntrega } from './card-entrega'
import type { EntregaCard } from './tipos'

export function EntregasCliente({
  disponiveis,
  minhas,
  cidade,
  nomeMercado,
  permissoes,
}: {
  disponiveis: EntregaCard[]
  minhas: EntregaCard[]
  cidade: string | null
  nomeMercado: string
  permissoes: { assumir: boolean; iniciar: boolean; finalizar: boolean }
}) {
  const [aba, setAba] = useState<'disponiveis' | 'minhas'>(
    minhas.length > 0 ? 'minhas' : 'disponiveis',
  )

  // A fila muda o tempo todo: se outro entregador assume, some da sua tela.
  // E o celular do entregador vive no bolso - por isso o hook tambem atualiza
  // no instante em que a tela volta a ser olhada.
  useAtualizacaoAoVivo({ canal: 'fila-entregas', tabelas: ['orders'] })

  const lista = aba === 'minhas' ? minhas : disponiveis

  return (
    <div className="space-y-4">
      <div className="flex gap-2 md:max-w-md">
        <button
          type="button"
          onClick={() => setAba('disponiveis')}
          className={`h-12 flex-1 rounded-xl font-bold ${
            aba === 'disponiveis' ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface'
          }`}
        >
          Disponiveis ({disponiveis.length})
        </button>
        <button
          type="button"
          onClick={() => setAba('minhas')}
          className={`h-12 flex-1 rounded-xl font-bold ${
            aba === 'minhas' ? 'bg-brand text-brand-foreground' : 'border border-line bg-surface'
          }`}
        >
          Minhas ({minhas.length})
        </button>
      </div>

      {lista.length === 0 ? (
        <Empty>
          {aba === 'minhas'
            ? 'Voce nao tem entregas em andamento.'
            : 'Nenhuma entrega esperando agora.'}
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {lista.map((entrega) => (
            <CardEntrega
              key={entrega.id}
              entrega={entrega}
              cidade={cidade}
              nomeMercado={nomeMercado}
              minha={aba === 'minhas'}
              permissoes={permissoes}
              aoAssumir={() => setAba('minhas')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
