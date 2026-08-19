'use client'

import { useMemo, useState, useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/card'
import { salvarPermissoes, type FormState } from '../actions'

export type PresetInfo = { id: string; name: string; slug: string; codes: string[] }
export type PermissionInfo = { code: string; module: string; label: string; description: string | null }

export function PermissoesForm({
  userId,
  presets,
  permissions,
  presetIdAtual,
  efetivas,
  doAtor,
  somenteLeitura,
}: {
  userId: string
  presets: PresetInfo[]
  permissions: PermissionInfo[]
  presetIdAtual: string | null
  efetivas: string[]
  doAtor: string[]
  somenteLeitura: boolean
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(salvarPermissoes, {})
  const [presetId, setPresetId] = useState(presetIdAtual ?? presets[0]?.id ?? '')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(efetivas))

  const doPreset = useMemo(
    () => new Set(presets.find((p) => p.id === presetId)?.codes ?? []),
    [presetId, presets],
  )
  const atorTem = useMemo(() => new Set(doAtor), [doAtor])

  const modulos = useMemo(() => {
    const mapa = new Map<string, PermissionInfo[]>()
    for (const p of permissions) {
      const lista = mapa.get(p.module) ?? []
      lista.push(p)
      mapa.set(p.module, lista)
    }
    return [...mapa.entries()]
  }, [permissions])

  function trocarPreset(id: string) {
    setPresetId(id)
    setMarcadas(new Set(presets.find((p) => p.id === id)?.codes ?? []))
  }

  function alternar(code: string) {
    setMarcadas((atual) => {
      const proxima = new Set(atual)
      if (proxima.has(code)) proxima.delete(code)
      else proxima.add(code)
      return proxima
    })
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={userId} />
      <input type="hidden" name="preset_id" value={presetId} />
      {[...marcadas].map((code) => (
        <input key={code} type="hidden" name="codes" value={code} />
      ))}

      <div className="space-y-1.5">
        <span className="block text-sm font-semibold">Perfil base</span>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={somenteLeitura}
              onClick={() => trocarPreset(p.id)}
              className={`rounded-xl border px-4 py-2.5 font-semibold ${
                presetId === p.id
                  ? 'border-brand bg-brand text-brand-foreground'
                  : 'border-line bg-surface'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">
          Trocar o perfil remarca as caixas. Depois disso, ajuste o que quiser: o que ficar
          diferente do perfil vale so para esta pessoa.
        </p>
      </div>

      <div className="space-y-4">
        {modulos.map(([modulo, lista]) => (
          <fieldset key={modulo} className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted">
              {modulo}
            </legend>
            <div className="space-y-1">
              {lista.map((p) => {
                const marcada = marcadas.has(p.code)
                const diferente = marcada !== doPreset.has(p.code)
                const bloqueada = somenteLeitura || (!atorTem.has(p.code) && !marcada)

                return (
                  <label
                    key={p.code}
                    className={`flex items-start gap-3 rounded-lg px-2 py-2 ${
                      bloqueada ? 'opacity-50' : 'hover:bg-black/[0.03]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-5 accent-[var(--brand)]"
                      checked={marcada}
                      disabled={bloqueada}
                      onChange={() => alternar(p.code)}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {p.label}
                        {diferente ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                            ajustado
                          </span>
                        ) : null}
                      </span>
                      {p.description ? (
                        <span className="block text-sm text-muted">{p.description}</span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}

      {!somenteLeitura ? (
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar permissoes'}
        </Button>
      ) : (
        <Alert>Voce nao tem permissao para alterar permissoes.</Alert>
      )}
    </form>
  )
}
