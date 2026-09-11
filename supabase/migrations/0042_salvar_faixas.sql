-- =============================================================================
-- 0042 - Salvar as faixas de distancia de uma vez
--
-- A tela edita a tabela inteira de faixas (acrescenta, tira, muda km e
-- valor). Apagar e regravar em duas chamadas do app deixaria o mercado sem
-- faixa nenhuma se a segunda falhasse - e sem faixa, modo distancia e "tudo
-- fora da area". Aqui e uma transacao so.
--
-- SECURITY INVOKER: as politicas de delivery_distance_bands (config.taxa_entrega)
-- valem como se a pessoa editasse linha por linha.
-- =============================================================================

create or replace function public.salvar_faixas_distancia(p_faixas jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.has_permission('config.taxa_entrega') then
    raise exception 'SEM_PERMISSAO' using detail = 'config.taxa_entrega', errcode = '42501';
  end if;
  if jsonb_typeof(p_faixas) <> 'array' or jsonb_array_length(p_faixas) > 20 then
    raise exception 'FAIXAS_INVALIDAS';
  end if;

  delete from public.delivery_distance_bands where true;

  insert into public.delivery_distance_bands (up_to_km, fee)
  select (f ->> 'up_to_km')::numeric, (f ->> 'fee')::numeric
    from jsonb_array_elements(p_faixas) f;
end;
$$;

revoke all on function public.salvar_faixas_distancia(jsonb) from public, anon, authenticated;
grant execute on function public.salvar_faixas_distancia(jsonb) to authenticated;
