-- =============================================================================
-- 0046 - Conferencia de estoque (bipagem)
--
-- O cadastro veio do PDV e carrega 5 anos de historico: ~4.8 mil produtos
-- ativos, boa parte comprada uma ou duas vezes e nunca mais. O PDV e simples
-- e nao exporta historico de venda, entao nao ha como separar "o que a loja
-- trabalha" de "o que passou por aqui em 2021" sem andar pela loja e bipar o
-- que esta na prateleira.
--
-- Uma conferencia e uma dessas caminhadas. Enquanto esta 'aberta' ela SO
-- acumula leitura - a vitrine nao muda em nada. A viragem acontece no fim,
-- de uma vez so, com previa e desfazer (proxima migration).
--
-- A quantidade e opcional e NAO e controle de estoque: ela nao baixa quando
-- vende, entao tratar como saldo oficial desanda em uma semana. Ela existe
-- para separar dois casos na hora de aplicar:
--   em branco ou > 0  ->  tem na prateleira
--   igual a 0         ->  a loja trabalha com isso, mas acabou
--
-- Codigo bipado que nao existe no cadastro nao e erro nem e descartado: vira
-- linha em stock_take_unknown, que e a lista de "cadastrar depois" - produto
-- novo que entrou na loja e nunca chegou ao sistema.
-- =============================================================================

create type public.stock_take_status as enum ('aberta', 'aplicada', 'cancelada');

-- Sessao de conferencia --------------------------------------------------------
create table public.stock_takes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (btrim(name) <> ''),
  status      public.stock_take_status not null default 'aberta',
  started_at  timestamptz not null default now(),
  started_by  uuid references public.profiles (id) on delete set null,
  applied_at  timestamptz,
  applied_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.stock_takes enable row level security;
create trigger trg_stock_takes_updated_at before update on public.stock_takes
  for each row execute function public.set_updated_at();

-- Uma conferencia aberta por vez: duas pessoas bipando em sessoes diferentes
-- dariam duas listas parciais, e aplicar qualquer uma delas apagaria metade
-- da loja. Indice parcial porque a restricao so vale para as abertas.
create unique index stock_takes_uma_aberta on public.stock_takes ((status))
  where status = 'aberta';

create index idx_stock_takes_recentes on public.stock_takes (started_at desc);

comment on table public.stock_takes is
  'Sessao de bipagem da loja. Aberta so acumula leitura; aplicar e que mexe na vitrine.';

-- Produto conferido ------------------------------------------------------------
create table public.stock_take_items (
  stock_take_id uuid not null references public.stock_takes (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  quantity      numeric(12,3) check (quantity is null or quantity >= 0),
  scanned_at    timestamptz not null default now(),
  scanned_by    uuid references public.profiles (id) on delete set null,
  primary key (stock_take_id, product_id)
);
alter table public.stock_take_items enable row level security;

-- A tela lista o que foi bipado por ultimo primeiro: e como a pessoa confere
-- se o item que acabou de passar entrou mesmo.
create index idx_stock_take_items_recentes
  on public.stock_take_items (stock_take_id, scanned_at desc);

comment on column public.stock_take_items.quantity is
  'Opcional. Nulo ou > 0 = tem na prateleira; 0 = trabalha com isso, mas acabou. Nao e saldo.';

-- Codigo lido que nao esta no cadastro -------------------------------------------
create table public.stock_take_unknown (
  stock_take_id    uuid not null references public.stock_takes (id) on delete cascade,
  barcode          text not null,
  first_scanned_at timestamptz not null default now(),
  last_scanned_at  timestamptz not null default now(),
  primary key (stock_take_id, barcode)
);
alter table public.stock_take_unknown enable row level security;

comment on table public.stock_take_unknown is
  'Codigo bipado sem produto no cadastro: fila de "cadastrar depois", nao erro.';

-- Permissoes ---------------------------------------------------------------------
insert into public.permissions (code, module, label, description, sort_order) values
  ('conferencia.realizar', 'Produtos', 'Fazer conferencia',
   'Abrir a conferencia e bipar os produtos da prateleira', 37),
  ('conferencia.aplicar',  'Produtos', 'Aplicar conferencia',
   'Usar a conferencia para definir o que aparece na vitrine', 38)
on conflict (code) do nothing;

insert into public.preset_permissions (preset_id, permission_code)
select p.id, c.code
  from public.permission_presets p
 cross join (values ('conferencia.realizar'), ('conferencia.aplicar')) as c(code)
 where p.slug = 'administrador'
on conflict do nothing;

-- Quem anda pela loja com o aparelho na mao e o balconista. Aplicar - que
-- tira milhares de produtos da vitrine de uma vez - fica so com o admin.
insert into public.preset_permissions (preset_id, permission_code)
select p.id, 'conferencia.realizar'
  from public.permission_presets p
 where p.slug = 'balconista'
on conflict do nothing;

-- RLS ------------------------------------------------------------------------------
-- Ver a conferencia acompanha ver produto: a tela de produtos mostra o andamento.
create policy stock_takes_select on public.stock_takes
  for select to authenticated
  using ((select public.has_permission('produtos.ver')));
create policy stock_takes_insert on public.stock_takes
  for insert to authenticated
  with check ((select public.has_permission('conferencia.realizar')));
create policy stock_takes_update on public.stock_takes
  for update to authenticated
  using ((select public.has_permission('conferencia.realizar'))
      or (select public.has_permission('conferencia.aplicar')))
  with check (true);

create policy stock_take_items_select on public.stock_take_items
  for select to authenticated
  using ((select public.has_permission('produtos.ver')));
create policy stock_take_items_write on public.stock_take_items
  for all to authenticated
  using ((select public.has_permission('conferencia.realizar')))
  with check ((select public.has_permission('conferencia.realizar')));

create policy stock_take_unknown_select on public.stock_take_unknown
  for select to authenticated
  using ((select public.has_permission('produtos.ver')));
create policy stock_take_unknown_write on public.stock_take_unknown
  for all to authenticated
  using ((select public.has_permission('conferencia.realizar')))
  with check ((select public.has_permission('conferencia.realizar')));

-- Catalogo para bipar offline -------------------------------------------------------
--
-- A tela baixa TODO o catalogo com codigo de barras uma vez, ao abrir, e
-- resolve cada bipada na memoria do aparelho. Sao ~4.8 mil linhas, uns 250 KB
-- - o custo de uma foto de produto.
--
-- O motivo e o corredor: 4G de mercado cai, e uma ida de rede por bipada
-- transformaria "bipou, proximo" numa espera de meio segundo cada, quando
-- funcionasse. Com o catalogo local a leitura e instantanea e a conferencia
-- inteira funciona sem sinal; o que vai para o servidor e a fila de leituras,
-- que sincroniza quando der.
--
-- 'inativo' vem so quando e verdade (a maioria esta ativa): produto inativo
-- que aparece na prateleira volta para a vitrine ao ser bipado, e a tela
-- avisa que vai voltar.
create or replace function public.catalogo_conferencia()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'nome', p.name, 'codigo', p.barcode)
      || case when p.is_active then '{}'::jsonb else jsonb_build_object('inativo', true) end
      order by p.name
    ),
    '[]'::jsonb
  )
    from public.products p
   where p.barcode is not null
     and btrim(p.barcode) <> '';
$$;

revoke all on function public.catalogo_conferencia() from public;
grant execute on function public.catalogo_conferencia() to authenticated;

comment on function public.catalogo_conferencia is
  'Catalogo com codigo de barras para a tela de conferencia resolver a bipada offline.';

-- Gravar leituras ---------------------------------------------------------------------
--
-- Recebe um LOTE porque a tela guarda as leituras no aparelho e sincroniza em
-- grupo: no corredor sem sinal a fila cresce e sobe inteira quando o sinal
-- volta. Reenviar o mesmo lote e inofensivo (upsert por produto), o que
-- importa quando a resposta se perde e a tela tenta de novo.
--
-- Cada leitura traz o produto que o APARELHO resolveu pelo catalogo local.
-- O id e conferido aqui contra products antes de gravar - leitura de produto
-- que sumiu do cadastro no meio da conferencia vira codigo desconhecido em
-- vez de erro no meio do lote.
create or replace function public.registrar_leituras(p_conferencia uuid, p_leituras jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  l              jsonb;
  v_status       public.stock_take_status;
  v_produto      uuid;
  v_codigo       text;
  v_quantidade   numeric;
  v_em           timestamptz;
  v_conferidos   integer := 0;
  v_desconhecidos integer := 0;
begin
  if not public.has_permission('conferencia.realizar') then
    raise exception 'SEM_PERMISSAO' using detail = 'conferencia.realizar', errcode = '42501';
  end if;

  select status into v_status from public.stock_takes where id = p_conferencia;
  if v_status is null then
    raise exception 'CONFERENCIA_NAO_ENCONTRADA';
  end if;
  if v_status <> 'aberta' then
    raise exception 'CONFERENCIA_FECHADA';
  end if;

  if jsonb_typeof(p_leituras) <> 'array' then
    raise exception 'LOTE_INVALIDO';
  end if;
  if jsonb_array_length(p_leituras) > 500 then
    raise exception 'LOTE_GRANDE' using detail = 'Maximo de 500 leituras por vez.';
  end if;

  for l in select * from jsonb_array_elements(p_leituras) loop
    v_codigo := btrim(coalesce(l ->> 'codigo', ''));
    v_quantidade := case when l ->> 'quantidade' is null then null
                         else (l ->> 'quantidade')::numeric end;
    -- Sem hora do aparelho (ou com hora adiantada) vale a do servidor.
    v_em := coalesce((l ->> 'em')::timestamptz, now());
    if v_em > now() then v_em := now(); end if;

    v_produto := null;
    if l ->> 'produto' is not null then
      select id into v_produto from public.products where id = (l ->> 'produto')::uuid;
    end if;

    if v_produto is not null then
      insert into public.stock_take_items (stock_take_id, product_id, quantity, scanned_at, scanned_by)
      values (p_conferencia, v_produto, v_quantidade, v_em, auth.uid())
      on conflict (stock_take_id, product_id) do update
        set quantity   = excluded.quantity,
            scanned_at = greatest(stock_take_items.scanned_at, excluded.scanned_at),
            scanned_by = excluded.scanned_by;
      v_conferidos := v_conferidos + 1;

    elsif v_codigo <> '' then
      insert into public.stock_take_unknown (stock_take_id, barcode, first_scanned_at, last_scanned_at)
      values (p_conferencia, v_codigo, v_em, v_em)
      on conflict (stock_take_id, barcode) do update
        -- Sem contador de vezes: o mesmo lote pode chegar duas vezes quando a
        -- resposta se perde, e a contagem viraria ficcao. Guarda a ultima.
        set last_scanned_at = greatest(stock_take_unknown.last_scanned_at, excluded.last_scanned_at);
      v_desconhecidos := v_desconhecidos + 1;
    end if;
  end loop;

  return jsonb_build_object('conferidos', v_conferidos, 'desconhecidos', v_desconhecidos);
end;
$$;

revoke all on function public.registrar_leituras(uuid, jsonb) from public;
grant execute on function public.registrar_leituras(uuid, jsonb) to authenticated;

comment on function public.registrar_leituras is
  'Grava um lote de leituras da conferencia. Idempotente: reenviar o mesmo lote nao duplica.';
