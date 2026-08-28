-- =============================================================================
-- 0029 - Auditoria de profiles sem o ruido do "ultimo acesso"
-- O painel grava profiles.last_seen_at a cada visita (com janela de 5 min), e
-- o trigger de auditoria registrava cada uma dessas gravacoes como alteracao
-- de funcionario. Resultado medido em 28/08/2026: 883 das 997 linhas de
-- audit_log eram isso. A trilha existe para responder "quem mudou o que" -
-- soterrada por "fulano abriu o painel", ela para de responder.
--
-- A correcao e no WHEN do trigger, nao na funcao: quem audita continua sendo
-- o mesmo trg_audit_row() de todas as outras tabelas. Muda so o criterio de
-- quando profiles merece uma linha - quando algo ALEM do horario de acesso
-- mudou. Nome, telefone, preset, ativo/inativo continuam auditados igual.
-- =============================================================================

drop trigger if exists trg_audit_profiles on public.profiles;

create trigger trg_audit_profiles
  after update on public.profiles
  for each row
  when (
    -- Compara a linha inteira menos os dois campos que mudam sozinhos.
    -- Tirar updated_at junto e essencial: ele e reescrito pelo trigger de
    -- carimbo em TODO update, inclusive no do last_seen_at.
    (to_jsonb(old) - 'last_seen_at' - 'updated_at')
      is distinct from
    (to_jsonb(new) - 'last_seen_at' - 'updated_at')
  )
  execute function public.trg_audit_row();

comment on table public.audit_log is
  'Trilha de quem mudou o que. Profiles so entra quando muda algo alem de last_seen_at (ver 0029).';
