# Mercado Massa 24h — Delivery

Aplicação web do delivery do Mercado Massa 24h: portal público para o cliente (sem login)
e painel interno da equipe com permissões granulares por usuário.

A raiz do domínio (`/`) é a entrada da equipe (pede login). A loja do cliente
vive em `/loja` — um link fixo, sempre disponível, que a equipe compartilha
pelo botão no cabeçalho do painel.

- Documento de arquitetura: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + RLS)
- Banco: projeto Supabase `massau` (`btycibxmcsjgcibcosvk`, `sa-east-1`)

## Como rodar

```bash
npm install
npm run dev
```

O `.env.local` já vem com a URL e a chave publicável do projeto. Falta apenas a chave
de servidor, usada só para criar contas de funcionário:

```
SUPABASE_SERVICE_ROLE_KEY=...
```

Pegue em **Supabase → Project Settings → API Keys → service_role**.
Ela **nunca** pode ganhar o prefixo `NEXT_PUBLIC_`.

## Primeiro acesso

1. Preencha `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`.
2. Abra `/painel/setup` e crie o administrador (nome, e-mail e senha).
3. A tela some sozinha depois disso — daí em diante os cadastros saem de `/painel/equipe`.

## Migrations

Ficam em `supabase/migrations/` e são aplicadas no projeto Supabase pelo MCP
(`apply_migration`), em ordem numérica. O banco é a fonte de verdade: preço, taxa de entrega,
pedido mínimo, totais, transições de status e permissões são validados no Postgres, não no front.

| Migration | Conteúdo |
|---|---|
| `0001` | Extensões, enums centralizados, normalização de texto/telefone |
| `0002` | Identidade e permissões granulares (`has_permission`, anti-escalada, trava do último admin) |
| `0003` | Catálogo, clientes, zonas de entrega e `resolve_delivery_fee` |
| `0004` | Configurações, formas de pagamento e auditoria |
| `0005` | Pedidos, itens, histórico de status, totais por peso |
| `0006` | RPCs do portal público (`create_public_order`, `get_order_by_token`) |
| `0007` | RPCs de operação (separação, peso, status, entregas) |
| `0008` | RLS de todas as tabelas + publicação de realtime |
| `0009` | Seed de permissões, presets, categorias e dados de exemplo |
| `0010`–`0011` | Endurecimento: `search_path` fixo e superfície mínima de API |
| `0012` | Bucket `produtos` no Storage, com escrita amarrada nas permissões |
| `0013` | Correções encontradas testando permissões granulares (grant de `normalize_text`, guardas ignoradas sem sessão) |
| `0014` | Auditoria de produtos e categorias |
| `0015` | Cidade do mercado (links de navegação e cabeçalho da impressão) |
| `0016` | Indicadores do dia no fuso do mercado e upload da logo |
| `0017` | Índices de chave estrangeira e policies de escrita separadas da leitura |
| `0018` | Fecha `dashboard_hoje()` para o visitante anônimo |

## Estado das etapas

- [x] **1** Arquitetura (documento validado)
- [x] **2** Banco, autenticação e permissões
- [x] **3** Produtos e categorias
- [x] **4** Portal público
- [x] **5** Carrinho e checkout
- [x] **6** Criação e gestão de pedidos
- [x] **7** Separação e produtos por peso
- [x] **8** Entregas / motoboy
- [x] **9** Impressão
- [x] **10** Dashboard e configurações
- [x] **11** Testes e refinamento

## Antes do go-live

1. Trocar os dados de exemplo: 3 regiões de entrega, 3 bairros e 4 produtos.
2. Preencher em `/painel/configuracoes` o nome, WhatsApp, endereço, **cidade/UF**,
   pedido mínimo e chave PIX reais.
3. Ligar a proteção contra senha vazada no Supabase (Authentication → Password).
4. Conferir o fuso horário — o dashboard usa ele para saber o que é "hoje".
