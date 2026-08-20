'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { PERMISSIONS } from '@/lib/permissions'
import { getStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BUCKET_PRODUTOS } from '@/lib/supabase/storage'
import { paraNumero, slugify } from '@/lib/format'
import type { UnitType } from '@/lib/types'

export type FormState = { error?: string; ok?: string }

/** UPDATE barrado pela RLS afeta zero linhas sem levantar erro. Ver actions de configuracoes. */
const BLOQUEADO = 'O banco recusou a alteracao: voce nao tem essa permissao.'

const UNIDADES: UnitType[] = ['unidade', 'pacote', 'caixa', 'kg', 'g']

function traduzirErroBarcode(error: { message: string; code?: string }): string {
  if (error.code === '23505' && error.message.includes('products_barcode_unico')) {
    return 'Ja existe outro produto cadastrado com este codigo de barras.'
  }
  return error.message
}

async function exigir(code: string): Promise<FormState> {
  const staff = await getStaff()
  if (!staff) return { error: 'Sessao expirada. Entre novamente.' }
  if (!staff.permissions.has(code)) return { error: 'Voce nao tem permissao para esta acao.' }
  return {}
}

/** Botao de um toque no balcao: "acabou" / "voltou". */
export async function alternarDisponibilidade(id: string, disponivel: boolean): Promise<FormState> {
  const guard = await exigir(PERMISSIONS.produtosAlterarDisponibilidade)
  if (guard.error) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .update({ is_available: disponivel })
    .eq('id', id)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: BLOQUEADO }

  revalidatePath('/painel/produtos')
  revalidatePath('/')
  return {}
}

export async function alternarAtivo(id: string, ativo: boolean): Promise<FormState> {
  const guard = await exigir(PERMISSIONS.produtosDesativar)
  if (guard.error) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .update({ is_active: ativo })
    .eq('id', id)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: BLOQUEADO }

  revalidatePath('/painel/produtos')
  revalidatePath('/')
  return {}
}

export type VerificacaoBarcode = { produtoExistente?: { id: string; name: string } }

/** Avisa antes de salvar se o codigo ja pertence a outro produto. */
export async function verificarCodigoBarras(
  codigo: string,
  produtoAtualId?: string,
): Promise<VerificacaoBarcode> {
  const guard = await exigir(PERMISSIONS.produtosCriar)
  if (guard.error) {
    const guardEditar = await exigir(PERMISSIONS.produtosEditar)
    if (guardEditar.error) return {}
  }
  if (!codigo.trim()) return {}

  const supabase = await createClient()
  const { data } = await supabase.rpc('find_product_by_barcode', {
    p_barcode: codigo.trim(),
    p_excluir_id: produtoAtualId ?? null,
  })

  const encontrado = Array.isArray(data) ? data[0] : null
  return encontrado ? { produtoExistente: { id: encontrado.id, name: encontrado.name } } : {}
}

export async function salvarProduto(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') ?? '')
  const criando = !id

  const guard = await exigir(criando ? PERMISSIONS.produtosCriar : PERMISSIONS.produtosEditar)
  if (guard.error) return guard

  const name = String(formData.get('name') ?? '').trim()
  const categoryId = String(formData.get('category_id') ?? '')
  const unitType = String(formData.get('unit_type') ?? 'unidade') as UnitType
  const porPeso = formData.get('sold_by_weight') === 'on'
  const preco = paraNumero(formData.get('price'))
  const passoGramas = Number(formData.get('weight_step_g') ?? 100)
  const minimoGramas = Number(formData.get('min_weight_g') ?? 100)
  const descricao = String(formData.get('short_description') ?? '').trim()
  const ordem = Number(formData.get('sort_order') ?? 0)
  const codigoBarras = String(formData.get('barcode') ?? '').trim()

  if (!name) return { error: 'Informe o nome do produto.' }
  if (!categoryId) return { error: 'Escolha a categoria.' }
  if (!UNIDADES.includes(unitType)) return { error: 'Unidade invalida.' }
  if (!Number.isFinite(preco) || preco <= 0) return { error: 'Informe um preco valido.' }
  if (porPeso && unitType !== 'kg' && unitType !== 'g') {
    return { error: 'Produto vendido por peso precisa ter unidade kg ou g.' }
  }
  if (porPeso && (passoGramas <= 0 || minimoGramas <= 0)) {
    return { error: 'Informe o incremento e o peso minimo em gramas.' }
  }

  const supabase = await createClient()

  // Imagem (opcional) -> Storage. A policy do bucket confere a permissao de novo.
  let imagePath: string | undefined
  const arquivo = formData.get('imagem')
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!arquivo.type.startsWith('image/')) return { error: 'Envie um arquivo de imagem.' }
    if (arquivo.size > 3 * 1024 * 1024) return { error: 'A imagem precisa ter no maximo 3 MB.' }

    const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const caminho = `${slugify(name)}-${Date.now()}.${extensao}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_PRODUTOS)
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })

    if (uploadError) return { error: `Falha ao enviar a imagem: ${uploadError.message}` }
    imagePath = caminho
  }

  const dados = {
    name,
    category_id: categoryId,
    short_description: descricao || null,
    unit_type: unitType,
    sold_by_weight: porPeso,
    price: preco,
    weight_step: porPeso ? passoGramas / 1000 : null,
    min_weight: porPeso ? minimoGramas / 1000 : null,
    sort_order: Number.isFinite(ordem) ? ordem : 0,
    barcode: codigoBarras || null,
    ...(imagePath ? { image_path: imagePath } : {}),
  }

  if (criando) {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...dados, slug: `${slugify(name)}-${Date.now().toString(36)}` })
      .select('id')
      .single()

    if (error) return { error: traduzirErroBarcode(error) }

    revalidatePath('/painel/produtos')
    revalidatePath('/')
    redirect(`/painel/produtos/${data.id}`)
  }

  const { data: anterior } = await supabase
    .from('products')
    .select('image_path')
    .eq('id', id)
    .maybeSingle()

  const { data: atualizado, error } = await supabase
    .from('products')
    .update(dados)
    .eq('id', id)
    .select('id')
  if (error) return { error: traduzirErroBarcode(error) }
  if (!atualizado?.length) return { error: BLOQUEADO }

  // Troca de foto: apaga a antiga para nao acumular lixo no bucket.
  if (imagePath && anterior?.image_path && anterior.image_path !== imagePath) {
    await supabase.storage.from(BUCKET_PRODUTOS).remove([anterior.image_path])
  }

  revalidatePath('/painel/produtos')
  revalidatePath(`/painel/produtos/${id}`)
  revalidatePath('/')
  return { ok: 'Produto salvo.' }
}
