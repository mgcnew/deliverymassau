import { redirect } from 'next/navigation'

/**
 * Raiz do dominio = entrada da equipe. A loja publica do cliente vive em
 * /loja (link fixo, sempre disponivel, compartilhado pelo botao do painel).
 * O layout de /painel ja faz a guarda de autenticacao (requireStaff),
 * entao basta redirecionar para la.
 */
export default function RootPage() {
  redirect('/painel')
}
