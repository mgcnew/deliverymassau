'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { Empty } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { CardEntrega } from './card-entrega'
import type { EntregaCard } from './tipos'

export function EntregasCliente({
  disponiveis,
  minhas,
  cidade,
  permissoes,
}: {
  disponiveis: EntregaCard[]
  minhas: EntregaCard[]
  cidade: string | null
  permissoes: { assumir: boolean; iniciar: boolean; finalizar: boolean }
}) {
  const router = useRouter()
  const [aba, setAba] = useState<'disponiveis' | 'minhas'>(
    minhas.length > 0 ? 'minhas' : 'disponiveis',
  )

  // A fila muda o tempo todo: se outro entregador assume, some da sua tela.
  useEffect(() => {
    const supabase = createClient()
    let canal: RealtimeChannel | null = null
    let vivo = true

    // Varios entregadores podem assumir/liberar corridas quase juntos -
    // agrupa numa janela curta em vez de um refresh por evento.
    let temporizador: ReturnType<typeof setTimeout> | null = null
    const atualizarAgrupado = () => {
      if (temporizador) clearTimeout(temporizador)
      temporizador = setTimeout(() => router.refresh(), 400)
    }

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!vivo) return
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token)

      canal = supabase
        .channel('fila-entregas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, atualizarAgrupado)
        .subscribe()
    })()

    const intervalo = setInterval(() => router.refresh(), 30_000)

    return () => {
      vivo = false
      if (temporizador) clearTimeout(temporizador)
      clearInterval(intervalo)
      if (canal) supabase.removeChannel(canal)
    }
  }, [router])

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
