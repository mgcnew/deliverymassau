/** Links de navegacao e contato do entregador. */

export type EnderecoEntrega = {
  street: string | null
  number: string | null
  district: string | null
  city?: string | null
}

export function enderecoTexto(endereco: EnderecoEntrega): string {
  return [
    [endereco.street, endereco.number].filter(Boolean).join(', '),
    endereco.district,
    endereco.city,
  ]
    .filter(Boolean)
    .join(' - ')
}

export function linkGoogleMaps(endereco: EnderecoEntrega): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    enderecoTexto(endereco),
  )}`
}

export function linkWaze(endereco: EnderecoEntrega): string {
  return `https://waze.com/ul?q=${encodeURIComponent(enderecoTexto(endereco))}&navigate=yes`
}

/** Sem telefone, abre o WhatsApp deixando a pessoa escolher pra quem mandar. */
export function linkWhatsapp(telefone: string | null | undefined, mensagem?: string): string {
  const query = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''
  if (!telefone) return `https://wa.me/${query}`

  const numero = telefone.replace(/\D/g, '')
  const comPais = numero.startsWith('55') ? numero : `55${numero}`
  return `https://wa.me/${comPais}${query}`
}

export function linkTelefone(telefone: string): string {
  return `tel:+55${telefone.replace(/\D/g, '')}`
}
