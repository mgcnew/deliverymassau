export const BUCKET_PRODUTOS = 'produtos'

/** URL publica da imagem do produto (bucket publico, sem assinatura). */
export function urlImagemProduto(path: string | null | undefined): string | null {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_PRODUTOS}/${path}`
}
