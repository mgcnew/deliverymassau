export type EnderecoPorCep = { bairro: string; rua: string } | null

/**
 * ViaCEP e publico, gratuito e sem chave -- por isso chamado direto do
 * navegador do cliente, sem passar pelo servidor. So preenche automatico;
 * o cliente sempre pode digitar/corrigir o endereco na mao.
 */
export async function buscarEnderecoPorCep(cepDigitos: string): Promise<EnderecoPorCep> {
  const resposta = await fetch(`https://viacep.com.br/ws/${cepDigitos}/json/`)
  if (!resposta.ok) return null

  const dados = await resposta.json()
  if (dados.erro) return null

  return { bairro: dados.bairro ?? '', rua: dados.logradouro ?? '' }
}
