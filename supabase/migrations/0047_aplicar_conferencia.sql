-- =============================================================================
-- 0047 - Aplicar a conferencia na vitrine (a viragem), com previa e desfazer
--
-- A conferencia (0046) so acumulou leitura. Aqui ela vira o catalogo:
--
--   conferido, sem quantidade ou > 0  ->  ativo e na vitrine
--   conferido, quantidade 0           ->  ativo, porem esgotado
--   NAO conferido                     ->  sai do catalogo (is_active = false)
--
-- A diferenca entre as duas ultimas linhas e o ponto todo. "Acabou"
-- (is_available) e o produto que a loja trabalha e esta em falta hoje; ele
-- continua na vitrine, marcado como esgotado. O que nunca foi bipado e outra
-- coisa - item que passou pela loja em 2021 e nunca mais - e esse sai do
-- catalogo. Jogar os dois no mesmo balde deixaria o cliente navegando numa
-- loja 70% esgotada.
--
-- Nada e apagado: o produto que sai guarda preco, foto, categoria e codigo.
-- Quando a mercadoria voltar, bipar na conferencia seguinte traz tudo de
-- volta - e por isso que a viragem e "condicional" e nao "substituir".
--
-- DUAS PROTECOES, porque isto muda milhares de linhas de uma vez:
--
--   previa_conferencia   diz exatamente o que vai acontecer antes de gravar.
--   stock_take_changes   guarda o estado anterior de cada produto alterado,
--                        e desfazer_conferencia devolve tudo.
--
-- E uma terceira, silenciosa: produto SEM codigo de barras nao pode ser
-- bipado (hoje sao 120 ativos, entre eles hortifruti e acougue vendidos por
-- peso). Aplicar sem cuidado tiraria todos eles do catalogo por um motivo que
-- nao tem nada a ver com a prateleira. Por padrao eles ficam.
-- =============================================================================

-- Estado anterior do que a viragem mudou ----------------------------------------
create table public.stock_take_changes (
  stock_take_id uuid not null references public.stock_takes (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  was_active    boolean not null,
  was_available boolean not null,
  primary key (stock_take_id, product_id)
);
alter table public.stock_take_changes enable row level security;

comment on table public.stock_take_changes is
  'Como cada produto estava antes da viragem. E o que desfazer_conferencia devolve.';

create policy stock_take_changes_select on public.stock_take_changes
  for select to authenticated
  using ((select public.has_permission('produtos.ver')));
create policy stock_take_changes_write on public.stock_take_changes
  for all to authenticated
  using ((select public.has_permission('conferencia.aplicar')))
  with check ((select public.has_permission('conferencia.aplicar')));

-- Quem aplica conferencia mexe em is_active ---------------------------------------
--
-- A viragem tira produto do catalogo, que e exatamente o que 'produtos.desativar'
-- protege. Sem abrir espaco aqui, so quem tivesse as duas permissoes conseguiria
-- aplicar - e a RLS/gatilho barrariam a funcao sem dizer por que.
--
-- Nao e ampliacao de poder: conferencia.aplicar ja significa "pode tirar milhares
-- de produtos da vitrine de uma vez". Poder desativar um produto e menos que isso.
drop policy products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using ((select public.has_permission('produtos.editar'))
      or (select public.has_permission('produtos.desativar'))
      or (select public.has_permission('produtos.alterar_disponibilidade'))
      or (select public.has_permission('conferencia.aplicar')))
  with check (true);

create or replace function public.trg_products_campos_sensiveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.has_permission('produtos.editar') then
    if new.is_active is distinct from old.is_active
       and not public.has_permission('produtos.desativar')
       and not public.has_permission('conferencia.aplicar') then
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.desativar', errcode = '42501';
    end if;

    if (new.name, new.category_id, new.price, new.unit_type, new.sold_by_weight,
        new.short_description, new.image_path, new.slug, new.sort_order,
        new.weight_step, new.min_weight, new.barcode)
       is distinct from
       (old.name, old.category_id, old.price, old.unit_type, old.sold_by_weight,
        old.short_description, old.image_path, old.slug, old.sort_order,
        old.weight_step, old.min_weight, old.barcode) then
      raise exception 'SEM_PERMISSAO' using detail = 'produtos.editar', errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- O que a viragem faria com cada produto -------------------------------------------
--
-- Uma funcao so, usada pela previa E pelo aplicar: se fossem duas consultas
-- parecidas, a previa poderia dizer uma coisa e a gravacao fazer outra - que e
-- justamente o erro que a previa existe para evitar.
--
-- acao:
--   'fica'    conferido e na vitrine
--   'acabou'  conferido com quantidade 0 - continua no catalogo, esgotado
--   'sai'     nao conferido - sai do catalogo
--   'mantido' nao conferido, mas sem codigo de barras: nao dava para bipar
--   'ja_fora' ja estava inativo e nao foi conferido - nada acontece
--
-- 'volta_a_vender' merece coluna propria porque some dentro de 'fica' e e a
-- unica mudanca da viragem que pode gerar venda de algo que a loja nao tem:
-- produto marcado como esgotado no balcao volta a ser vendido so por ter sido
-- bipado. Faz sentido (bipou = esta na prateleira), mas quem aplica precisa
-- ver o numero - a etiqueta na gondola continua la mesmo com a caixa vazia.
create or replace function public.conferencia_efeito(
  p_conferencia uuid,
  p_manter_sem_codigo boolean default true
)
returns table (
  product_id   uuid,
  acao         text,
  volta        boolean,
  volta_a_vender boolean,
  novo_ativo   boolean,
  nova_vitrine boolean,
  muda         boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      p.id,
      p.is_active,
      p.is_available,
      (p.barcode is null or btrim(p.barcode) = '')      as sem_codigo,
      (i.product_id is not null)                        as conferido,
      -- So faz sentido quando conferido; sem linha, quantity e nulo.
      (i.product_id is not null and (i.quantity is null or i.quantity > 0)) as na_prateleira
      from public.products p
      left join public.stock_take_items i
        on i.stock_take_id = p_conferencia
       and i.product_id = p.id
  ),
  alvo as (
    select
      b.*,
      case
        when b.conferido                             then true
        when not b.is_active                         then false
        when b.sem_codigo and p_manter_sem_codigo    then true
        else false
      end as novo_ativo,
      case when b.conferido then b.na_prateleira else b.is_available end as nova_vitrine
      from base b
  )
  select
    a.id,
    case
      when a.conferido and a.na_prateleira          then 'fica'
      when a.conferido                              then 'acabou'
      when not a.is_active                          then 'ja_fora'
      when a.sem_codigo and p_manter_sem_codigo     then 'mantido'
      else 'sai'
    end,
    a.conferido and not a.is_active,
    a.conferido and a.is_active and not a.is_available and a.na_prateleira,
    a.novo_ativo,
    a.nova_vitrine,
    (a.novo_ativo, a.nova_vitrine) is distinct from (a.is_active, a.is_available)
    from alvo a;
$$;

revoke all on function public.conferencia_efeito(uuid, boolean) from public;
grant execute on function public.conferencia_efeito(uuid, boolean) to authenticated;

-- Previa ---------------------------------------------------------------------------
create or replace function public.previa_conferencia(
  p_conferencia uuid,
  p_manter_sem_codigo boolean default true
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'fica',                count(*) filter (where acao = 'fica'),
    'acabou',              count(*) filter (where acao = 'acabou'),
    'sai',                 count(*) filter (where acao = 'sai'),
    'mantidos_sem_codigo', count(*) filter (where acao = 'mantido'),
    'voltam',              count(*) filter (where volta),
    'voltam_a_vender',     count(*) filter (where volta_a_vender),
    'mudam',               count(*) filter (where muda),
    'vitrine_depois',      count(*) filter (where novo_ativo),
    'para_cadastrar',      (select count(*) from public.stock_take_unknown
                             where stock_take_id = p_conferencia)
  )
    from public.conferencia_efeito(p_conferencia, p_manter_sem_codigo);
$$;

revoke all on function public.previa_conferencia(uuid, boolean) from public;
grant execute on function public.previa_conferencia(uuid, boolean) to authenticated;

-- Aplicar ----------------------------------------------------------------------------
create or replace function public.aplicar_conferencia(
  p_conferencia uuid,
  p_manter_sem_codigo boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status     public.stock_take_status;
  v_conferidos integer;
  v_alterados  integer;
begin
  if not public.has_permission('conferencia.aplicar') then
    raise exception 'SEM_PERMISSAO' using detail = 'conferencia.aplicar', errcode = '42501';
  end if;

  select status into v_status from public.stock_takes where id = p_conferencia;
  if v_status is null then raise exception 'CONFERENCIA_NAO_ENCONTRADA'; end if;
  if v_status <> 'aberta' then raise exception 'CONFERENCIA_NAO_ABERTA'; end if;

  -- Conferencia sem nenhuma leitura apagaria a loja inteira. Isso nunca e o
  -- que a pessoa quis: e sempre engano de clicar antes de bipar.
  select count(*) into v_conferidos
    from public.stock_take_items where stock_take_id = p_conferencia;
  if v_conferidos = 0 then raise exception 'CONFERENCIA_VAZIA'; end if;

  -- Um comando so: as duas partes enxergam a MESMA foto da tabela, entao o
  -- que 'guarda' grava como estado anterior e o estado de antes do update,
  -- mesmo os dois acontecendo juntos.
  with efeito as (
    select * from public.conferencia_efeito(p_conferencia, p_manter_sem_codigo) where muda
  ),
  guarda as (
    insert into public.stock_take_changes (stock_take_id, product_id, was_active, was_available)
    select p_conferencia, e.product_id, p.is_active, p.is_available
      from efeito e
      join public.products p on p.id = e.product_id
    on conflict (stock_take_id, product_id) do nothing
    returning 1
  )
  update public.products p
     set is_active = e.novo_ativo,
         is_available = e.nova_vitrine
    from efeito e
   where p.id = e.product_id;

  get diagnostics v_alterados = row_count;

  update public.stock_takes
     set status = 'aplicada', applied_at = now(), applied_by = auth.uid()
   where id = p_conferencia;

  return jsonb_build_object('alterados', v_alterados, 'conferidos', v_conferidos);
end;
$$;

revoke all on function public.aplicar_conferencia(uuid, boolean) from public;
grant execute on function public.aplicar_conferencia(uuid, boolean) to authenticated;

-- Desfazer -----------------------------------------------------------------------------
--
-- Devolve cada produto ao estado anterior e reabre a conferencia, para poder
-- bipar o que faltou e aplicar de novo.
--
-- Devolve o estado anterior tal e qual: se alguem editou a disponibilidade de
-- um produto na mao entre aplicar e desfazer, essa edicao se perde. E o preco
-- de um desfazer honesto, e o motivo de a tela dizer para usar logo apos
-- aplicar, nao dias depois.
create or replace function public.desfazer_conferencia(p_conferencia uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status    public.stock_take_status;
  v_abertas   integer;
  v_voltaram  integer;
begin
  if not public.has_permission('conferencia.aplicar') then
    raise exception 'SEM_PERMISSAO' using detail = 'conferencia.aplicar', errcode = '42501';
  end if;

  select status into v_status from public.stock_takes where id = p_conferencia;
  if v_status is null then raise exception 'CONFERENCIA_NAO_ENCONTRADA'; end if;
  if v_status <> 'aplicada' then raise exception 'CONFERENCIA_NAO_APLICADA'; end if;

  -- Ela volta a ser a conferencia aberta, e so pode haver uma.
  select count(*) into v_abertas from public.stock_takes where status = 'aberta';
  if v_abertas > 0 then raise exception 'JA_HA_CONFERENCIA_ABERTA'; end if;

  update public.products p
     set is_active = c.was_active,
         is_available = c.was_available
    from public.stock_take_changes c
   where c.stock_take_id = p_conferencia
     and p.id = c.product_id;

  get diagnostics v_voltaram = row_count;

  delete from public.stock_take_changes where stock_take_id = p_conferencia;

  update public.stock_takes
     set status = 'aberta', applied_at = null, applied_by = null
   where id = p_conferencia;

  return jsonb_build_object('voltaram', v_voltaram);
end;
$$;

revoke all on function public.desfazer_conferencia(uuid) from public;
grant execute on function public.desfazer_conferencia(uuid) to authenticated;

comment on function public.aplicar_conferencia is
  'Usa a conferencia como catalogo da loja. Guarda o estado anterior para desfazer.';
comment on function public.desfazer_conferencia is
  'Devolve os produtos ao estado de antes da viragem e reabre a conferencia.';
