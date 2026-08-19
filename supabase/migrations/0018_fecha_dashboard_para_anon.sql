-- =============================================================================
-- 0018 - Fecha dashboard_hoje() para o visitante anonimo
--
-- Toda funcao NOVA nasce com EXECUTE para PUBLIC. Como a 0011 rodou antes da
-- 0016, dashboard_hoje() voltou a ficar exposta em /rest/v1/rpc. Ela ja negava
-- por permissao (has_permission), mas superficie de API que ninguem usa nao
-- deve existir.
--
-- LEMBRETE para as proximas migrations: ao criar funcao nova, revogar de PUBLIC
-- e conceder so a quem precisa.
-- =============================================================================

revoke all on function public.dashboard_hoje() from public, anon;
grant execute on function public.dashboard_hoje() to authenticated;
