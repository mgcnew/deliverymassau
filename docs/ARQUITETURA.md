# Mercado Massa 24h — Delivery
## Documento Técnico de Arquitetura (ETAPA 1 — para validação)

> Status: **proposta**. Nenhum código de aplicação foi escrito ainda.
> Objetivo: fechar decisões de arquitetura, modelo de dados, permissões e RLS antes da ETAPA 2.

---

## 1. Visão geral da arquitetura

**Aplicação única (monolito modular) em Next.js (App Router) + Supabase.** Sem microserviços.

```
┌───────────────────────────────────────────────────────────────┐
│  Next.js (Vercel)                                             │
│                                                               │
│  app/(loja)      → Portal público do cliente (sem login)      │
│  app/(cliente)   → Área do cliente por link/token             │
│  app/(painel)    → Painel interno (Supabase Auth + permissões)│
│                                                               │
│  Server Components  → leitura de dados (catálogo, pedidos)    │
│  Server Actions     → escrita (checkout, separação, status)   │
│  Client Components  → carrinho, busca, realtime, formulários  │
└───────────────┬───────────────────────────────────────────────┘
                │ supabase-js (anon key)  +  RPCs SECURITY DEFINER
┌───────────────▼───────────────────────────────────────────────┐
│  Supabase                                                     │
│  Postgres (fonte de verdade)  •  RLS em todas as tabelas      │
│  Auth (somente equipe)        •  Realtime (pedidos/entregas)  │
│  Storage (imagens de produto e logo)                          │
│  Funções SQL: permissões, taxa de entrega, criação de pedido, │
│               recálculo de totais, histórico e auditoria      │
└───────────────────────────────────────────────────────────────┘
```

### Princípios estruturais

1. **O banco é a fonte de verdade.** Preço, taxa de entrega, pedido mínimo, totais e transições de status são calculados e validados no Postgres — nunca só no frontend.
2. **O cliente público nunca faz `INSERT` direto em `orders`.** O pedido nasce por uma RPC `SECURITY DEFINER` que revalida tudo (preços vêm do banco, não do carrinho).
3. **Permissão é dado, não código.** Nenhum `if (role === 'admin')` espalhado. Existe um catálogo de permissões, presets como atalho e overrides por usuário. A mesma função (`has_permission`) protege UI, Server Action e RLS.
4. **Status e permissões vivem em enums/constantes centralizadas**, geradas a partir do banco (`generate_typescript_types`).
5. **`service_role` só existe no servidor** (Server Actions / Route Handlers), nunca em `NEXT_PUBLIC_*`. E mesmo lá é exceção: quase tudo passa por RLS.

### Camadas de código

```
src/
  lib/supabase/{browser,server,admin}.ts   clientes tipados
  lib/permissions.ts                       códigos + helpers (can/require)
  lib/orders/status.ts                     enum + transições permitidas
  lib/pricing/                             formatação e cálculo espelhado (UI)
  lib/delivery/fee.ts                      chamada única do cálculo de taxa
  server/actions/                          Server Actions por domínio
  components/ui/                            design system básico
  components/loja/ | components/painel/
```

**Regra de isolamento pedida no briefing:** o cálculo de taxa de entrega fica em **um único lugar no banco** (`resolve_delivery_fee`) e **um único lugar no front** (`lib/delivery/fee.ts`, que apenas consulta). Trocar de "bairro" para "raio/distância" no futuro = trocar essa função.

---

## 2. Mapa completo das páginas

### 2.1 Portal público do cliente — `app/(loja)` — sem autenticação

| Rota | Conteúdo | Observações |
|---|---|---|
| `/` | Identidade, busca, categorias, destaques, grade de produtos, carrinho flutuante | Mobile-first; SSR + cache curto |
| `/c/[categoria]` | Produtos da categoria | |
| `/busca?q=` | Resultado de pesquisa | Busca por nome + descrição |
| `/p/[slug]` | Detalhe do produto (foto, descrição, unidade, observação) | Também disponível como bottom-sheet sem trocar de rota |
| `/carrinho` | Itens, quantidade/peso, observação por item, subtotal, taxa estimada, total | Taxa só aparece depois do bairro |
| `/checkout` | Dados pessoais → endereço → pagamento/troco → revisão | Uma etapa por vez, mobile-first |
| `/pedido/[token]` | **Área do cliente**: acompanhamento do pedido em tempo real | Link permanente entregue no fim do checkout |
| `/meus-pedidos` | Lista dos pedidos feitos naquele dispositivo/telefone | Sem senha (ver §3.1) |
| Estado "fechado" | Banner global + bloqueio do checkout | Quando `delivery_ativo = false` |

### 2.2 Painel interno — `app/(painel)` — Supabase Auth

| Rota | Permissão exigida |
|---|---|
| `/painel/login` | — |
| `/painel` (dashboard) | `dashboard.ver` |
| `/painel/pedidos` (colunas por status, tempo real) | `pedidos.ver` |
| `/painel/pedidos/[id]` | `pedidos.ver` |
| `/painel/pedidos/[id]/separacao` | `pedidos.separar` |
| `/painel/pedidos/[id]/imprimir` | `pedidos.imprimir` |
| `/painel/produtos` (+ filtro Disponíveis/Indisponíveis/Todos) | `produtos.ver` |
| `/painel/produtos/novo` · `/painel/produtos/[id]` | `produtos.criar` · `produtos.editar` |
| `/painel/categorias` | `categorias.gerenciar` |
| `/painel/entregas` (disponíveis) · `/painel/entregas/minhas` | `entregas.ver` |
| `/painel/clientes` · `/painel/clientes/[id]` | `clientes.ver` |
| `/painel/equipe` · `/painel/equipe/[id]` | `equipe.ver` · `equipe.alterar_permissoes` |
| `/painel/configuracoes` (Mercado · Delivery · Zonas · Pagamento · PIX) | `config.acessar` + permissões finas por aba |

O menu lateral/inferior é montado a partir das permissões efetivas do usuário: **o que ele não pode, ele não vê** — e mesmo que force a URL, o `layout` do grupo e a RLS barram.

---

## 3. Fluxo Cliente → Separação → Entrega

```
CLIENTE (celular, sem login)
  navega → adiciona ao carrinho → checkout
  ├─ informa nome + WhatsApp
  ├─ informa endereço  ──► resolve_delivery_fee(bairro) ──► taxa OU "região não atendida" (bloqueia)
  ├─ valida pedido mínimo (subtotal SEM taxa)
  ├─ escolhe pagamento (apenas os ativos) → se DINHEIRO: precisa troco? → troco para quanto?
  └─ confirma ──► RPC create_public_order()
                    • revalida preços/disponibilidade no banco
                    • revalida taxa, mínimo, delivery aberto, forma de pagamento
                    • cria/atualiza customer (chave: telefone normalizado)
                    • gera order_number amigável (#1047) + public_token
                    • grava itens com valores ESTIMADOS
                    • status = RECEBIDO  (+ histórico)
                 ◄── retorna { order_number, public_token }
  cliente é levado a /pedido/[token]  ← link permanente de acompanhamento

BALCÃO (painel, realtime)
  pedido novo pisca em "Recebidos"
  ├─ assume separação  → status SEPARANDO (+ histórico, quem)
  ├─ item comum        → confirma separado
  ├─ item por peso     → digita peso real → recalcula item e total (trigger no banco)
  ├─ item em falta     → marca indisponível → sai do total (+ auditoria)
  └─ conclui           → status AGUARDANDO ENTREGADOR

ENTREGA (painel mobile do motoboy)
  ├─ vê fila "Entregas disponíveis"
  ├─ ASSUMIR (UPDATE condicional atômico — sem conflito entre dois motoboys)
  ├─ INICIAR → status SAIU PARA ENTREGA
  ├─ Google Maps / Waze / ligar / WhatsApp
  └─ MARCAR ENTREGUE → status ENTREGUE (+ atualiza métricas do cliente)

Em qualquer ponto antes de ENTREGUE: CANCELADO (permissão pedidos.cancelar + motivo obrigatório)
Cada transição grava order_status_history. O cliente vê tudo em /pedido/[token] via Realtime.
```

### 3.1 Área do cliente (detalhe pedido explicitamente)

O cliente **não cria conta e não tem senha**. Ele tem:

- **Link do portal** (sempre o mesmo, divulgável no WhatsApp/status/Instagram): `massa24h.com.br` → loja.
- **Link do pedido**: `/pedido/<public_token>` — token aleatório de 128 bits, impossível de adivinhar. É o "comprovante vivo": status em tempo real, itens, peso ajustado, valor final, endereço, troco, botão de WhatsApp com o mercado.
- **`/meus-pedidos`**: os tokens ficam no `localStorage` do aparelho. Trocou de celular / limpou o navegador? O balcão reenvia o link pelo WhatsApp. Nada de senha, nada de cadastro.

Consequência importante: **o valor pode mudar depois da compra** (peso real, item em falta). A área do cliente precisa deixar isso explícito — "valor estimado" antes da separação, "valor final" depois — para não gerar atrito na porta.

---

## 4. Tabela de permissões

Catálogo em `permissions` (código = chave, usado igual em UI, Server Action e RLS).

| Módulo | Código | O que libera |
|---|---|---|
| Dashboard | `dashboard.ver` | Painel inicial e indicadores |
| Pedidos | `pedidos.ver` | Ver a tela operacional e os pedidos |
| | `pedidos.editar` | Alterar itens/endereço/observações |
| | `pedidos.alterar_status` | Mover o pedido no fluxo |
| | `pedidos.separar` | Abrir a tela de separação e confirmar itens |
| | `pedidos.ajustar_peso` | Informar peso real (recalcula valor) |
| | `pedidos.marcar_indisponivel` | Remover item em falta durante a separação |
| | `pedidos.cancelar` | Cancelar pedido (exige motivo) |
| | `pedidos.imprimir` | Abrir a via de impressão |
| Produtos | `produtos.ver` · `produtos.criar` · `produtos.editar` · `produtos.desativar` | CRUD |
| | `produtos.alterar_disponibilidade` | Botão rápido Disponível/Indisponível |
| Categorias | `categorias.gerenciar` | Criar, editar, ordenar, desativar |
| Entregas | `entregas.ver` | Fila de entregas e "minhas entregas" |
| | `entregas.ver_todas` | Ver entregas de todos os entregadores |
| | `entregas.assumir` · `entregas.iniciar` · `entregas.finalizar` | Ciclo da entrega |
| | `entregas.atribuir` | Atribuir/retirar entrega de outra pessoa |
| Clientes | `clientes.ver` | Lista e histórico de clientes |
| Equipe | `equipe.ver` · `equipe.cadastrar` · `equipe.editar` · `equipe.desativar` | Gestão de funcionários |
| | `equipe.alterar_permissoes` | Editar permissões de outros |
| | `equipe.cadastrar_admin` | Criar outro administrador |
| Configurações | `config.acessar` | Entrar em configurações |
| | `config.mercado` · `config.pagamentos` · `config.pix` | Abas específicas |
| | `config.taxa_entrega` | Zonas e taxas |
| | `config.pedido_minimo` | Valor mínimo |
| | `config.delivery_status` | Abrir/fechar o delivery |

### Modelo de resolução

```
permissões efetivas(usuário) =
      permissões do preset do usuário
    ∪ permissões concedidas individualmente (user_permissions.granted = true)
    ∖ permissões revogadas individualmente (user_permissions.granted = false)
```

- **Preset é atalho, não identidade.** Um motoboy pode receber `pedidos.separar`; um balconista pode receber `entregas.assumir`. A UI de equipe mostra o preset com os checkboxes já marcados e destaca em cor diferente o que foi alterado individualmente.
- Presets iniciais: **Administrador** (todas), **Balconista** (`pedidos.*` operacional + `produtos.ver` + `produtos.alterar_disponibilidade` + `pedidos.imprimir`), **Motoboy** (`entregas.ver/assumir/iniciar/finalizar` + histórico próprio).
- Ponto sensível: quem tem `equipe.alterar_permissoes` **não pode conceder o que não possui** (evita escalada de privilégio). Só quem tem `equipe.cadastrar_admin` cria um usuário com todas as permissões. Regra aplicada em função SQL, não só na tela.
- Trava anti-tijolo: o sistema impede remover a última conta ativa com `equipe.cadastrar_admin`.

---

## 5. Modelo de dados

Convenções: PK `uuid` (`gen_random_uuid()`), `created_at`/`updated_at` (`timestamptz`, trigger de update), desativação lógica (`is_active`) em vez de `DELETE`, dinheiro em `numeric(12,2)`, peso em `numeric(10,3)` (kg com 3 casas = grama), telefone normalizado em dígitos.

### 5.1 Identidade e permissões

```
profiles              id (=auth.users.id) · nome · telefone · preset_id → permission_presets
                      is_active · last_seen_at · created_at · updated_at
permissions           code (PK) · module · label · description · sort
permission_presets    id · nome · slug · is_system · is_active
preset_permissions    preset_id · permission_code            (PK composta)
user_permissions      user_id · permission_code · granted bool · granted_by · created_at (PK composta)
```

### 5.2 Catálogo

```
categories            id · nome · slug (unique) · sort_order · is_active
products              id · category_id → categories · nome · slug (unique)
                      descricao_curta · image_path
                      unit_type (enum) · sold_by_weight bool
                      price numeric(12,2)          -- por unidade OU por kg (ver regra)
                      weight_step numeric(10,3)    -- ex.: 0.100 kg (só peso)
                      min_weight  numeric(10,3)
                      is_active bool · is_available bool · sort_order
                      created_at · updated_at
```

> **Decisão:** um único campo `price`, cujo significado é dado por `sold_by_weight` (`true` ⇒ preço por kg). Evita dois campos de preço divergindo. `CHECK (NOT sold_by_weight OR unit_type IN ('kg','g'))`.

### 5.3 Clientes

```
customers             id · phone (unique, normalizado) · nome
                      orders_count · total_spent · first_order_at · last_order_at
customer_addresses    id · customer_id → customers · cep · rua · numero · bairro
                      complemento · referencia · zone_id → delivery_zones
                      is_default · created_at
```

### 5.4 Entrega

```
delivery_zones        id · nome · match_type (enum: bairro | regiao | raio)
                      fee numeric(12,2) · is_active · sort_order
zone_neighborhoods    id · zone_id → delivery_zones · bairro_normalizado (unique)
                      -- normalizado = minúsculo, sem acento, sem pontuação
```
Preparado para o futuro (`raio`): colunas `center_lat/lng/radius_km` já previstas e ignoradas na v1.

### 5.5 Pedidos

```
orders   id · order_number int UNIQUE (sequence) · public_token text UNIQUE
         customer_id → customers
         -- snapshot do cliente/endereço no momento do pedido (histórico imutável)
         customer_name · customer_phone
         address_cep · address_street · address_number · address_district
         address_complement · address_reference
         zone_id → delivery_zones · delivery_fee
         items_subtotal_estimated · items_subtotal_final · total
         status (enum) · payment_method (enum)
         needs_change bool · change_for numeric(12,2) · change_amount (calculado)
         customer_note
         separated_by → profiles · separation_started_at · separation_finished_at
         delivery_person_id → profiles · assigned_at · dispatched_at · delivered_at
         cancelled_at · cancelled_by · cancel_reason
         created_at · updated_at

order_items  id · order_id → orders · product_id → products
             product_name · unit_type · sold_by_weight · unit_price   -- SNAPSHOT
             requested_quantity numeric(10,3)     -- nunca sobrescrito
             weighed_quantity   numeric(10,3)     -- só peso, preenchido na separação
             estimated_total · final_total
             item_status (enum: pendente | separado | indisponivel)
             note · separated_by → profiles · separated_at

order_status_history  id · order_id · from_status · to_status · changed_by → profiles
                      note · created_at

delivery_assignments  id · order_id · delivery_person_id · assigned_at
                      released_at · released_by   -- histórico de quem assumiu/desistiu
```

### 5.6 Configuração e auditoria

```
settings          id (singleton, CHECK id = 1)
                  market_name · market_phone · market_logo_path · market_address
                  delivery_enabled bool · delivery_closed_message
                  min_order_value numeric(12,2)
                  pix_key · pix_receiver_name
                  updated_by · updated_at
payment_methods   code (PK: pix|dinheiro|debito|credito) · label · is_active · sort
audit_log         id · table_name · record_id · action · actor_id
                  before jsonb · after jsonb · created_at
```

### 5.7 Relacionamentos (resumo)

```
permission_presets 1─N profiles 1─N user_permissions N─1 permissions
categories 1─N products 1─N order_items N─1 orders N─1 customers 1─N customer_addresses
delivery_zones 1─N zone_neighborhoods
delivery_zones 1─N orders
orders 1─N order_status_history
orders 1─N delivery_assignments
profiles 1─N orders (separated_by, delivery_person_id, cancelled_by)
```

Índices previstos: `orders(status, created_at desc)`, `orders(delivery_person_id, status)`, `orders(customer_id)`, `orders(public_token)`, `order_items(order_id)`, `products(category_id, is_active, is_available, sort_order)`, `products` GIN em `nome` para busca, `customers(phone)`, `zone_neighborhoods(bairro_normalizado)`.

---

## 6. Estados possíveis do pedido

```sql
create type order_status as enum (
  'recebido', 'separando', 'aguardando_entregador',
  'saiu_para_entrega', 'entregue', 'cancelado'
);
```

Transições permitidas (validadas por trigger — não só na UI):

| De | Para |
|---|---|
| `recebido` | `separando`, `cancelado` |
| `separando` | `aguardando_entregador`, `cancelado` |
| `aguardando_entregador` | `saiu_para_entrega`, `separando` (voltar/corrigir), `cancelado` |
| `saiu_para_entrega` | `entregue`, `cancelado` |
| `entregue` | — (final) |
| `cancelado` | — (final) |

Regras: `saiu_para_entrega` exige `delivery_person_id`; `cancelado` exige motivo; `entregue` carimba `delivered_at` e atualiza `customers`. Toda transição grava `order_status_history` por trigger — impossível mudar status sem histórico.

Outros enums: `unit_type` (`unidade|pacote|caixa|kg|g`), `payment_method` (`pix|dinheiro|debito|credito`), `order_item_status`, `zone_match_type`.

---

## 7. Regras dos produtos vendidos por peso

**Exemplo canônico — Alcatra a R$ 49,90/kg, cliente pede ~1 kg, balança marca 1,087 kg:**

| Campo | Valor |
|---|---|
| `unit_price` (snapshot do preço/kg) | 49,90 |
| `requested_quantity` | 1,000 kg ← **nunca sobrescrito** |
| `estimated_total` | 49,90 |
| `weighed_quantity` (separação) | 1,087 kg |
| `final_total` | 54,24 (1,087 × 49,90 = 54,2413 → arredonda para 2 casas) |

Regras:

1. `final_total = round(coalesce(weighed_quantity, requested_quantity) * unit_price, 2)`, calculado por **trigger no banco**. O front nunca envia total.
2. Item `indisponivel` ⇒ `final_total = 0` e sai da soma (o pedido continua válido).
3. Trigger em `order_items` recalcula `orders.items_subtotal_final` e `orders.total = items_subtotal_final + delivery_fee`.
4. Alterar peso exige `pedidos.ajustar_peso`, grava `separated_by`/`separated_at` e entra em `audit_log` (valor antes/depois).
5. Só é possível pesar enquanto o pedido está em `separando`.
6. UI da separação: teclado numérico grande, entrada em **gramas** (1087) com conversão automática para kg — mais rápido e menos errado que digitar "1,087" no celular.
7. O cliente vê no acompanhamento: "Peso solicitado 1,000 kg · Peso separado 1,087 kg · R$ 54,25".
8. Tolerância: se o peso separado divergir mais do que X% do solicitado, a tela pede confirmação (evita erro de digitação tipo 10,87 kg). X configurável, sugestão inicial 30%.

---

## 8. Estratégia de cálculo da entrega

- Fonte única: `resolve_delivery_fee(p_bairro text, p_cep text default null) returns table(zone_id uuid, fee numeric, atendido boolean)`.
- v1 casa por **bairro normalizado** (minúsculo, sem acento, sem pontuação) em `zone_neighborhoods`. Um mesmo bairro escrito de várias formas ("Sto. Antônio", "santo antonio") é resolvido por normalização + apelidos cadastráveis.
- No checkout o bairro é um **select** das zonas atendidas (não texto livre): elimina 90% dos erros de digitação e já mostra a taxa antes de continuar. Campo de texto livre fica como fallback com aviso.
- Sem correspondência ⇒ `atendido = false` ⇒ checkout bloqueado com mensagem amigável ("Ainda não entregamos no seu bairro — mas você pode retirar no mercado / falar com a gente no WhatsApp").
- A taxa é **recalculada dentro da RPC de criação do pedido** e gravada em `orders.delivery_fee` (snapshot). Mudança futura de tabela de preços não altera pedidos antigos.
- Evolução prevista sem refatorar telas: `match_type = 'raio'` com geocodificação do CEP, trocando apenas o corpo de `resolve_delivery_fee`.

---

## 9. Estratégia de pedido mínimo

- `settings.min_order_value` (ex.: R$ 30,00).
- Comparação usa **`items_subtotal` (produtos), sem a taxa de entrega** — conforme briefing.
- Três camadas: carrinho mostra "Faltam R$ X para o mínimo de R$ Y" com barra de progresso → checkout desabilita o botão → **RPC valida de novo e recusa** (`ERRO_PEDIDO_MINIMO`).
- Itens marcados como indisponíveis na separação podem derrubar o pedido abaixo do mínimo: **não bloqueia** (o pedido já existe), apenas registra. Decisão de negócio a confirmar com você.

---

## 10. Fluxo de pagamento e troco

1. O checkout lista apenas `payment_methods` com `is_active = true`.
2. Selecionou **DINHEIRO** → "Precisa de troco?" → Não / Sim.
3. **Sim** → "Troco para quanto?" → valida `change_for >= total`; senão mostra "O valor precisa ser maior que o total do pedido".
4. `change_amount = change_for − total`, exibido como "Troco estimado: R$ 36,50".
5. Se o total mudar na separação (peso/falta), o troco estimado é recalculado automaticamente e aparece atualizado na impressão e no painel do motoboy. **Esse é o ponto crítico de operação** — o entregador precisa ver o troco do valor final, não do estimado.
6. Pagamento é sempre **na entrega** na v1. Nenhum gateway. PIX = chave exibida na tela do pedido, na impressão e no card do motoboy; a baixa é manual.

---

## 11. Estratégia de impressão

- Rota dedicada `/painel/pedidos/[id]/imprimir`, layout próprio (sem menus), `window.print()` automático.
- CSS `@media print` + variável de largura: `--print-width: 80mm` (padrão térmica) e uma opção A4 para papel comum. Fonte monoespaçada, alto contraste, sem cinza claro, sem imagem pesada.
- Conteúdo exatamente como no briefing: cabeçalho **MERCADO MASSA 24H**, `PEDIDO #XXXX`, data/hora, cliente, endereço completo, itens (`qtd/peso × produto`, preço unitário, subtotal), **observações destacadas em caixa**, subtotal, taxa, **TOTAL**, forma de pagamento, troco para / troco estimado, observação geral.
- Itens por peso imprimem as duas linhas: solicitado e separado.
- Itens indisponíveis aparecem riscados com "EM FALTA" (o cliente precisa entender o valor).
- Preparado para térmica: nada de layout dependente de largura fixa em px, tudo em `mm`/`ch`, e o HTML já sai numa estrutura que pode virar ESC/POS depois sem redesenhar.

---

## 12. Painel do motoboy

- `/painel/entregas` — mobile-first de verdade: cards grandes, botão único por ação, sem tabela.
- **Entregas disponíveis** = pedidos em `aguardando_entregador` sem entregador.
- **Minhas entregas** = `delivery_person_id = auth.uid()` em `aguardando_entregador` ou `saiu_para_entrega`.
- Card: número, cliente, **bairro em destaque**, endereço completo, referência, telefone, forma de pagamento, **valor a receber**, troco, observação.
- Ações: `ASSUMIR` → `INICIAR ENTREGA` → `MARCAR COMO ENTREGUE`; além de `LIGAR`, `WHATSAPP`, `GOOGLE MAPS`, `WAZE`.
- Links de navegação montados a partir do endereço:
  - Maps: `https://www.google.com/maps/dir/?api=1&destination=<endereço urlencoded>`
  - Waze: `https://waze.com/ul?q=<endereço urlencoded>&navigate=yes`
- **Assumir é atômico**: `UPDATE orders SET delivery_person_id = auth.uid(), assigned_at = now() WHERE id = $1 AND delivery_person_id IS NULL AND status = 'aguardando_entregador'`. Zero linhas afetadas ⇒ "Outro entregador já assumiu" e a lista se atualiza. Sem race condition, sem lock explícito.
- Realtime na fila para o pedido sumir da tela dos outros assim que alguém assume.

---

## 13. Estratégia de autenticação

- **Supabase Auth (e-mail + senha) apenas para a equipe.** Cliente não autentica (§3.1).
- Cadastro de funcionário é feito **pelo administrador**, via Server Action que usa `service_role` no servidor: cria o usuário em `auth.users`, cria o `profile` e aplica o preset. Signup público **desabilitado** no projeto Supabase.
- Sessão via cookies (`@supabase/ssr`), lida em Server Components e no `middleware`.
- Guardas em três níveis: `middleware` (tem sessão?) → `layout` do grupo/página (`requirePermission('...')`) → RLS/RPC no banco. Nunca só a UI.
- Desativar funcionário = `profiles.is_active = false` (bloqueia acesso na primeira checagem) + revogar sessões. **Nunca `DELETE`** de quem tem histórico em pedidos.
- `last_seen_at` atualizado de forma barata (no máximo 1×/5min) para a coluna "último acesso" da tela de equipe.

---

## 14. Estratégia de RLS

RLS **habilitada em todas as tabelas**, inclusive as de configuração. Sem policy = sem acesso.

### Funções base (`SECURITY DEFINER`, `STABLE`, `search_path` fixo)

```sql
has_permission(p_code text) -- usa auth.uid(), consulta preset + overrides, respeita profiles.is_active
is_staff()                  -- existe profile ativo para auth.uid()
```
Essas funções **não** são afetadas por RLS (definer), o que evita o clássico **loop de recursão** entre `profiles` ↔ policies.

### Papel `anon` (portal público)

| Tabela | Policy |
|---|---|
| `categories` | `SELECT` onde `is_active` |
| `products` | `SELECT` onde `is_active` (o `is_available` filtra a compra, mas o produto pode aparecer esgotado) |
| `settings` | **Nenhum acesso direto.** Uma view `public_settings` expõe só nome, logo, telefone, mínimo, delivery aberto/fechado, PIX |
| `payment_methods` | `SELECT` onde `is_active` |
| `delivery_zones` | `SELECT` onde `is_active` (nome + taxa, para o select do checkout) |
| `orders`, `order_items`, `customers`, `profiles`, `audit_log`, … | **sem policy = negado** |

Criação de pedido e consulta pelo token acontecem **só por RPC**:
- `create_public_order(payload jsonb)` — `SECURITY DEFINER`, revalida tudo, retorna número + token.
- `get_order_by_token(p_token text)` — retorna **um** pedido com itens; `p_token` tem 128 bits (enumeração inviável) e a função só devolve os campos que o cliente pode ver (sem dados internos, sem nome do funcionário).

Isso garante os requisitos do §30 do briefing: o cliente não vê pedidos de terceiros, não consulta equipe, não lê dados internos, e não consegue forjar preço nem taxa.

### Papel `authenticated` (equipe)

Padrão das policies:

```sql
create policy pedidos_select on orders for select to authenticated
  using (has_permission('pedidos.ver'));

create policy pedidos_status on orders for update to authenticated
  using (has_permission('pedidos.alterar_status') or has_permission('entregas.assumir'))
  with check (...);   -- transições e campos validados também por trigger
```

- Entregador sem `entregas.ver_todas` só enxerga a fila livre e as **próprias** entregas.
- `profiles`: cada um lê o próprio; ler os outros exige `equipe.ver`; escrever exige `equipe.editar`.
- `user_permissions`/`preset_permissions`: escrita exige `equipe.alterar_permissoes` **e** a regra "não conceder o que não tem".
- `settings`/`delivery_zones`/`payment_methods`: leitura para staff, escrita conforme `config.*`.
- `audit_log` e `order_status_history`: `INSERT` só por trigger (`SECURITY DEFINER`); ninguém edita ou apaga.
- `service_role` continua ignorando RLS — por isso ele só aparece em Server Actions específicas (criar funcionário, upload).

### Realtime

Realtime respeita RLS. Publicação limitada a `orders`, `order_items` e `order_status_history`. Como o cliente público é `anon` e não tem `SELECT` em `orders`, o acompanhamento em `/pedido/[token]` usa **polling leve + revalidação** ou um canal por token — decisão fechada na ETAPA 6 (ver risco R7).

---

## 15. Auditoria

`audit_log` gravado por trigger nas operações críticas: peso, preço, total do pedido, status, cancelamento, atribuição de entregador, alteração de permissões, mudança de taxa/mínimo/formas de pagamento. Sempre com `actor_id`, `before`, `after`, `created_at`. Nunca editável.

---

## 16. Riscos técnicos a resolver antes de implementar

| # | Risco | Impacto | Encaminhamento proposto |
|---|---|---|---|
| R1 | **Recursão de RLS** em `profiles`/permissões | Erro 500 em toda a app | `has_permission` como `SECURITY DEFINER` com `search_path` fixo; testes de policy antes das telas |
| R2 | **Escalada de privilégio** — quem edita permissões conceder mais do que tem | Comprometimento total | Regra "não conceder o que não possui" em função SQL + trava da última conta admin |
| R3 | **Concorrência ao assumir entrega** | Dois motoboys na mesma entrega | `UPDATE` condicional atômico + checagem de linhas afetadas (§12) |
| R4 | **Número amigável do pedido** sob concorrência | Números duplicados/pulados | `sequence` dedicada + `UNIQUE`. Pular número em falha é aceitável; duplicar não |
| R5 | **Arredondamento monetário** no cálculo por peso | Centavos divergindo entre tela, impressão e cobrança | Tudo `numeric` no Postgres, arredondamento único no banco, front só formata. Proibido `float` |
| R6 | **Preço mudou entre o carrinho e o pedido** | Cliente vê um valor, sistema cobra outro | RPC usa o preço do banco e, se divergir do carrinho, retorna a diferença para confirmação explícita do cliente |
| R7 | **Realtime para o cliente anônimo** sem furar a RLS | Vazamento de pedidos alheios | Canal por token ou polling; decidir na ETAPA 6. Nunca abrir `SELECT` de `orders` para `anon` |
| R8 | **Normalização de bairro/telefone** | Zona não encontrada; cliente duplicado | `unaccent` + lower + trim; telefone só dígitos com DDD; select de bairros no checkout |
| R9 | **Valor final ≠ valor informado ao cliente** (peso/falta) | Atrito na porta | Linguagem "estimado" antes da separação; WhatsApp automático quando o final variar acima de um limite |
| R10 | **Imagens de produto** | Portal lento no 4G do cliente | Supabase Storage + `next/image`, limite de tamanho, upload já redimensionado |
| R11 | **Fuso horário** nos relatórios "de hoje" | Dashboard errado depois da meia-noite (crítico num 24h!) | `timestamptz` no banco, agregações com fuso explícito. **Preciso confirmar a cidade/fuso** |
| R12 | **Operação 24h e mudança de turno** | Não se sabe quem fez o quê | Histórico + auditoria com `actor_id` desde o dia 1 |
| R13 | **Pedido em separação quando o delivery é fechado** | Pedido órfão | Fechar bloqueia apenas **novos** pedidos; os em andamento seguem o fluxo |
| R14 | **Impressora térmica futura** | Refazer a impressão | Layout em `mm`, sem dependência de cor/imagem; estrutura convertível para ESC/POS |
| R15 | **`service_role` vazar para o cliente** | Comprometimento total | Só em Server Actions/Route Handlers; lint/CI barrando `SERVICE_ROLE` fora de `server/` |
| R16 | **Sem ambiente separado** (dev = produção) | Dados de teste no ar | Definir agora: projeto Supabase novo e dedicado; limpeza antes do go-live |

---

## 17. Decisões tomadas (padrões recomendados, confirmados em 19/08/2026)

| # | Questão | Decisão aplicada |
|---|---|---|
| 1 | Bairro no checkout | **Select das zonas atendidas** (texto livre só como fallback) |
| 2 | Fuso horário | **`America/Sao_Paulo`**, gravado em `settings.timezone` — trocável na tela de Configurações se o mercado for de outro fuso |
| 3 | Item em falta que derruba o pedido abaixo do mínimo | **Mantém o pedido** (ele já existe); o mínimo só bloqueia a criação |
| 4 | Retirada no balcão | **Fora da v1**, mas o schema já tem `orders.fulfillment` (`entrega`/`retirada`); ligar depois não exige migration de dados |
| 5 | Projeto Supabase | Projeto **`massau`** (`btycibxmcsjgcibcosvk`, região `sa-east-1`), que já existia e estava vazio. Ambiente único: dev hoje, produção depois |
| 6 | Dados do mercado | Seed com valores padrão (nome "Mercado Massa 24h", mínimo R$ 30,00); os reais entram em Configurações |
| 7 | Bairros e taxas | Seed **exemplo** (Centro R$ 5,00 · Zona 1 R$ 7,00 · Zona 2 R$ 10,00) para o fluxo rodar ponta a ponta; substituir pelos reais antes do go-live |

> **Dados de exemplo a limpar antes do go-live:** as 3 zonas de entrega, os 3 bairros e os 4 produtos de teste (Alcatra, Coca-Cola 2L, Queijo mussarela, Arroz 5kg).

## 18. Estado da implementação (19/08/2026)

Todas as 11 etapas do plano foram implementadas. O que existe hoje:

| Etapa | Entrega | Onde |
|---|---|---|
| 1 | Este documento | `docs/ARQUITETURA.md` |
| 2 | Banco completo (18 migrations), autenticação e permissões granulares | `supabase/migrations/`, `/painel/equipe` |
| 3 | Categorias e produtos com disponibilidade de um toque | `/painel/produtos`, `/painel/categorias` |
| 4 | Portal público do cliente | `/`, `/c/[slug]`, `/p/[slug]`, `/busca` |
| 5 | Carrinho, checkout e área do cliente | `/carrinho`, `/checkout`, `/pedido/[token]`, `/meus-pedidos` |
| 6 | Tela operacional em tempo real e detalhe do pedido | `/painel/pedidos` |
| 7 | Separação com pesagem em gramas | `/painel/pedidos/[id]/separacao` |
| 8 | Painel do motoboy com Maps e Waze | `/painel/entregas` |
| 9 | Impressão 80mm e A4 | `/painel/pedidos/[id]/imprimir` |
| 10 | Dashboard no fuso do mercado e configurações | `/painel`, `/painel/configuracoes` |
| 11 | Revisão de segurança, advisors e refino | migrations `0017`–`0018` |

### Riscos do §16 e como ficaram

| # | Situação |
|---|---|
| R1 | Resolvido. `has_permission` é `SECURITY DEFINER`; nenhuma recursão de RLS apareceu |
| R2 | Resolvido e testado. Não se concede o que não se tem; a última conta de administrador não pode ser desativada (a trava disparou no teste) |
| R3 | Resolvido e testado. Segunda tentativa de assumir a mesma entrega recebe `ENTREGA_JA_ASSUMIDA` |
| R4 | Resolvido. `sequence` dedicada com `UNIQUE` |
| R5 | Resolvido. Todo cálculo em `numeric`, arredondado uma única vez no banco |
| R6 | Resolvido. `expected_total` faz o banco recusar e a tela pede confirmação com o novo valor |
| R7 | Resolvido de forma diferente do previsto: o cliente **não** usa Realtime — a página do pedido lê por token a cada visita. Realtime ficou só no painel interno, onde há sessão |
| R8 | Resolvido. Normalização com `unaccent` e select de bairros no checkout |
| R9 | Resolvido. A página do produto explica a pesagem antes da compra e o acompanhamento mostra "estimado" x "final" |
| R10 | Parcial. Storage com limite de 3 MB e tipos restritos; falta redimensionar no upload |
| R11 | Resolvido. `dashboard_hoje()` calcula o dia no fuso de `settings.timezone` |
| R12 | Resolvido. Histórico e auditoria com autor desde o primeiro dia |
| R13 | Resolvido. Fechar o delivery bloqueia só pedidos novos |
| R14 | Preparado. Layout em `mm`, sem cor nem imagem |
| R15 | Resolvido. `service_role` só em Server Action, usada apenas para criar conta de funcionário |
| R16 | **Em aberto** — ambiente único. Os dados de exemplo precisam sair antes do go-live |

### Pendências conhecidas

1. **Dados de exemplo no banco**: 3 regiões, 3 bairros e 4 produtos. Substituir em Configurações e Produtos.
2. **Proteção contra senha vazada** (Supabase Auth → Password): desligada. Vale ligar antes de cadastrar a equipe.
3. **Redimensionar imagem no upload** (R10): hoje o limite é só de tamanho de arquivo.
4. **Retirada no balcão**: o schema já tem `orders.fulfillment`, a interface ainda não.
5. **Cliente sem realtime**: se o acompanhamento precisar atualizar sozinho, o caminho é polling na página do token.
