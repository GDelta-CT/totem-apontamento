-- =====================================================================
-- Rollback da Migration 007 — Lockdown de leitura
-- Alvo: projeto de TESTE  GDelta-Totem-Teste  (ref pvrnimckfgdmgjrjueap)
-- Recria o estado ANTERIOR ao lockdown: as políticas abertas do `anon` e os
-- GRANTs do `anon` nas 4 tabelas-base (espelho do bootstrap "OPÇÃO A").
-- Use se o lockdown quebrar algo e for preciso voltar atrás rápido.
-- =====================================================================

begin;

-- 1) Recriar as políticas abertas do anon
create policy "anon pode ler funcionarios ativos" on public.funcionarios
  for select to anon, authenticated using (ativo = true);

create policy "anon pode ler ordens_servico" on public.ordens_servico
  for select to anon, authenticated using (true);

create policy "anon pode ler apontamentos" on public.apontamentos
  for select to anon, authenticated using (true);
create policy "anon pode criar apontamentos" on public.apontamentos
  for insert to anon, authenticated with check (true);
create policy "anon pode atualizar apontamentos" on public.apontamentos
  for update to anon, authenticated using (true) with check (true);

create policy "pontos_select_all" on public.pontos_eletronicos
  for select to anon, authenticated using (true);
create policy "pontos_insert_all" on public.pontos_eletronicos
  for insert to anon, authenticated with check (true);

-- 2) Restaurar os GRANTs do anon (espelho do bootstrap)
grant select                 on public.funcionarios       to anon;
grant select                 on public.ordens_servico     to anon;
grant select, insert, update on public.apontamentos       to anon;
grant select, insert         on public.pontos_eletronicos to anon;

commit;
