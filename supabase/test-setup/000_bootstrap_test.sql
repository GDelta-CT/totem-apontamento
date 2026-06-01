-- =====================================================================
-- FASE 0 — Bootstrap do projeto de TESTE (GDelta-Totem-Teste, São Paulo)
-- ref: pvrnimckfgdmgjrjueap
-- Objetivo: espelhar o estado atual de PRODUÇÃO para testar a transição.
-- Decisão do fundador: OPÇÃO A — devolver os GRANTs do anon nas 4 tabelas-base
--   (em prod eles faltam, por isso o totem dá 401 lá; aqui queremos o totem
--    anon funcionando para testar a migração de forma útil).
-- NÃO replica a event-trigger rls_auto_enable (divergência menor e conhecida).
-- =====================================================================

-- 1) TABELAS (ordem de dependência) -----------------------------------
CREATE TABLE public.oficinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(120) NOT NULL, cnpj VARCHAR(20), razao_social VARCHAR(160),
  endereco TEXT, telefone VARCHAR(30), email VARCHAR(120), responsavel VARCHAR(120),
  capacidade_boxes INT NOT NULL DEFAULT 10, funcionarios_ativos INT NOT NULL DEFAULT 1,
  horas_dia_disponivel NUMERIC(4,2) NOT NULL DEFAULT 8.8,
  hora_homem_venda NUMERIC(10,2) NOT NULL DEFAULT 85.00,
  hora_homem_custo NUMERIC(10,2) NOT NULL DEFAULT 28.00,
  meta_faturamento_mensal NUMERIC(12,2) DEFAULT 120000.00,
  meta_margem_liquida NUMERIC(5,2) DEFAULT 20.00, meta_retrabalho_max NUMERIC(5,2) DEFAULT 5.00,
  meta_prazo_max_dias INT DEFAULT 35, meta_ticket_medio NUMERIC(10,2) DEFAULT 4000.00,
  prazo_seguradora_dias INT DEFAULT 30, prazo_particular_dias INT DEFAULT 0,
  multa_atraso_pct NUMERIC(5,2) DEFAULT 2.00, juros_mensal_pct NUMERIC(5,2) DEFAULT 1.00,
  desconto_avista_pct NUMERIC(5,2) DEFAULT 5.00,
  asaas_customer_id VARCHAR(60), asaas_subscription_id VARCHAR(60),
  plano VARCHAR(20) NOT NULL DEFAULT 'trial',
  status_assinatura VARCHAR(20) NOT NULL DEFAULT 'ativa', trial_ate TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_oficinas (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  oficina_id UUID REFERENCES public.oficinas(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('dono','gerente','operario','contador')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, oficina_id)
);

CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL, cargo VARCHAR(50) NOT NULL,
  nivel_acesso VARCHAR(20) DEFAULT 'Nível C', ativo BOOLEAN DEFAULT true,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id)
);

CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa VARCHAR(7) NOT NULL UNIQUE, modelo_veiculo VARCHAR(100) NOT NULL,
  status_geral VARCHAR(50) DEFAULT 'Aguardando Produção',
  data_entrada TIMESTAMP DEFAULT now(),
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id)
);

CREATE TABLE public.apontamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID REFERENCES public.ordens_servico(id),
  nome_funcionario VARCHAR(100) NOT NULL, cargo_funcionario VARCHAR(50) NOT NULL,
  hora_inicio TIMESTAMP DEFAULT now(), hora_fim TIMESTAMP,
  status_tarefa VARCHAR(50) DEFAULT 'Em andamento',
  etapa VARCHAR(50), motivo_pausa VARCHAR(50), pausado_em TIMESTAMP,
  tempo_pausado_seg INTEGER DEFAULT 0,
  oficina_id UUID NOT NULL REFERENCES public.oficinas(id),
  CONSTRAINT chk_etapa_valida CHECK (etapa IS NULL OR etapa IN
    ('Orcamento','AguardandoPeca','Desmontagem','Funilaria','Preparacao',
     'Pintura','Polimento','Montagem','Qualidade','Entrega','Outros'))
);

CREATE TABLE public.pontos_eletronicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_funcionario VARCHAR(120) NOT NULL, cargo_funcionario VARCHAR(60),
  tipo VARCHAR(20) NOT NULL, registrado_em TIMESTAMP NOT NULL DEFAULT now(),
  observacao TEXT, oficina_id UUID NOT NULL REFERENCES public.oficinas(id)
);

-- 2) ÍNDICES (espelho de prod) ----------------------------------------
CREATE INDEX idx_funcionarios_oficina ON public.funcionarios(oficina_id);
CREATE INDEX idx_ordens_servico_oficina ON public.ordens_servico(oficina_id);
CREATE INDEX idx_ordens_servico_placa_upper ON public.ordens_servico(upper(placa::text));
CREATE INDEX idx_apontamentos_etapa ON public.apontamentos(etapa);
CREATE INDEX idx_apontamentos_oficina ON public.apontamentos(oficina_id);
CREATE INDEX idx_apontamentos_funcionario_status ON public.apontamentos(nome_funcionario, status_tarefa);
CREATE INDEX idx_apontamentos_status_funcionario ON public.apontamentos(nome_funcionario, status_tarefa);
CREATE INDEX idx_pontos_eletronicos_oficina ON public.pontos_eletronicos(oficina_id);
CREATE INDEX idx_pontos_funcionario_data ON public.pontos_eletronicos(nome_funcionario, registrado_em DESC);
CREATE INDEX idx_pontos_tipo ON public.pontos_eletronicos(tipo);

-- 3) RLS ligado + forçado ---------------------------------------------
ALTER TABLE public.oficinas           ENABLE ROW LEVEL SECURITY; ALTER TABLE public.oficinas           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_oficinas      ENABLE ROW LEVEL SECURITY; ALTER TABLE public.user_oficinas      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios       ENABLE ROW LEVEL SECURITY; ALTER TABLE public.funcionarios       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico     ENABLE ROW LEVEL SECURITY; ALTER TABLE public.ordens_servico     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.apontamentos       ENABLE ROW LEVEL SECURITY; ALTER TABLE public.apontamentos       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pontos_eletronicos ENABLE ROW LEVEL SECURITY; ALTER TABLE public.pontos_eletronicos FORCE ROW LEVEL SECURITY;

-- 4) FUNÇÃO + TRIGGER (igual prod) ------------------------------------
CREATE OR REPLACE FUNCTION public.set_atualizado_em() RETURNS TRIGGER AS $f$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $f$ LANGUAGE plpgsql;
CREATE TRIGGER trg_oficinas_atualizado BEFORE UPDATE ON public.oficinas
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- 5) POLICIES (13, espelho exato de prod) -----------------------------
CREATE POLICY "anon pode ler funcionarios ativos" ON public.funcionarios FOR SELECT TO anon, authenticated USING (ativo = true);
CREATE POLICY "oficina_isolation_funcionarios" ON public.funcionarios FOR ALL TO authenticated
  USING (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid) WITH CHECK (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "anon pode ler ordens_servico" ON public.ordens_servico FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "oficina_isolation_ordens_servico" ON public.ordens_servico FOR ALL TO authenticated
  USING (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid) WITH CHECK (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "anon pode ler apontamentos" ON public.apontamentos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon pode criar apontamentos" ON public.apontamentos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon pode atualizar apontamentos" ON public.apontamentos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "oficina_isolation_apontamentos" ON public.apontamentos FOR ALL TO authenticated
  USING (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid) WITH CHECK (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "pontos_select_all" ON public.pontos_eletronicos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pontos_insert_all" ON public.pontos_eletronicos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "oficina_isolation_pontos" ON public.pontos_eletronicos FOR ALL TO authenticated
  USING (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid) WITH CHECK (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "oficina_isolation_self" ON public.oficinas FOR ALL TO authenticated
  USING (id = (auth.jwt() ->> 'oficina_id')::uuid) WITH CHECK (id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "user_ve_proprios_vinculos" ON public.user_oficinas FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 6) GRANTS ------------------------------------------------------------
-- 6a) oficinas/user_oficinas = igual prod
GRANT ALL ON public.oficinas      TO anon, authenticated;
GRANT ALL ON public.user_oficinas TO anon, authenticated;
-- 6b) OPÇÃO A — devolver grants nas 4 tabelas-base (totem anon funciona)
GRANT SELECT                ON public.funcionarios       TO anon, authenticated;
GRANT SELECT                ON public.ordens_servico     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.apontamentos      TO anon, authenticated;
GRANT SELECT, INSERT        ON public.pontos_eletronicos  TO anon, authenticated;

-- 7) SEED mínimo -------------------------------------------------------
DO $$ DECLARE demo UUID;
BEGIN
  INSERT INTO public.oficinas (nome, plano, status_assinatura)
    VALUES ('Oficina Demo', 'trial', 'ativa') RETURNING id INTO demo;
  INSERT INTO public.funcionarios (nome, cargo, oficina_id) VALUES
    ('João Silva','Funileiro', demo), ('Maria Souza','Pintora', demo),
    ('Carlos Lima','Preparador', demo), ('Ana Pereira','Montadora', demo);
  INSERT INTO public.ordens_servico (placa, modelo_veiculo, oficina_id) VALUES
    ('ABC1D23','Honda Civic 2020', demo), ('XYZ4E56','Toyota Corolla 2019', demo),
    ('QWE7R89','VW Golf 2021', demo);
END $$;
