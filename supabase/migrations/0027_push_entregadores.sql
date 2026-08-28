-- =============================================================================
-- 0027 - Aviso de pedido novo no celular do entregador (Web Push)
-- Tempo real so alcanca quem esta com a tela aberta. Com o app fechado -- que
-- e o normal para quem esta na rua -- o unico caminho e a notificacao do
-- proprio sistema operacional, e para isso o servidor precisa guardar o
-- "endereco" de cada aparelho inscrito.
--
-- O que fica guardado aqui nao e segredo do usuario: e a URL que o servico de
-- push do navegador (Google, Apple, Mozilla) da para entregar a mensagem, mais
-- as duas chaves publicas que cifram o conteudo. Sem a chave privada VAPID do
-- servidor, ninguem envia nada para esses enderecos.
-- =============================================================================

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,

  -- Unico por aparelho+navegador. Se o celular trocar de dono dentro da
  -- equipe, o mesmo endpoint volta com outro profile_id (upsert no app).
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,

  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  -- Envio que falha por aparelho desinstalado/expirado (404/410) apaga a
  -- linha; este contador cobre a falha passageira, de rede.
  failures        smallint not null default 0
);
alter table public.push_subscriptions enable row level security;

create index idx_push_subscriptions_profile on public.push_subscriptions (profile_id);

comment on table public.push_subscriptions is
  'Aparelhos inscritos para receber aviso de pedido novo. O envio roda no servidor com service_role.';

-- RLS: cada funcionario cuida apenas dos proprios aparelhos. O envio e feito
-- pelo servidor com service_role, que nao passa por estas politicas.
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (profile_id = (select auth.uid()));
