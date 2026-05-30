-- =====================================================================
-- Migration 002 — Estrutura Multi-tenant
-- Pre-requisito: Migration 001 (RLS) ja aplicada
-- =====================================================================

-- 1) Tabela oficinas (tenant)
CREATE TABLE public.oficinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(120) NOT NULL,
  cnpj VARCHAR(20),
  razao_social VARCHAR(160),
  endereco TEXT,
  telefone VARCHAR(30),
  email VARCHAR(120),
  responsavel VARCHAR(120),
  capacidade_boxes INT NOT NULL DEFAULT 10,
  funcionarios_ativos INT NOT NULL DEFAULT 1,
  horas_dia_disponivel NUMERIC(4,2) NOT NULL DEFAULT 8.8,
  hora_homem_venda NUMERIC(10,2) NOT NULL DEFAULT 85.00,
  hora_homem_custo NUMERIC(10,2) NOT NULL DEFAULT 28.00,
  meta_faturamento_mensal NUMERIC(12,2) DEFAULT 120000.00,
  meta_margem_liquida NUMERIC(5,2) DEFAULT 20.00,
  meta_retrabalho_max NUMERIC(5,2) DEFAULT 5.00,
  meta_prazo_max_dias INT DEFAULT 35,
  meta_ticket_medio NUMERIC(10,2) DEFAULT 4000.00,
  prazo_seguradora_dias INT DEFAULT 30,
  prazo_particular_dias INT DEFAULT 0,
  multa_atraso_pct NUMERIC(5,2) DEFAULT 2.00,
  juros_mensal_pct NUMERIC(5,2) DEFAULT 1.00,
  desconto_avista_pct NUMERIC(5,2) DEFAULT 5.00,
  asaas_customer_id VARCHAR(60),
  asaas_subscription_id VARCHAR(60),
  plano VARCHAR(20) NOT NULL DEFAULT 'trial',
  status_assinatura VARCHAR(20) NOT NULL DEFAULT 'ativa',
  trial_ate TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficinas FORCE ROW LEVEL SECURITY;

-- 2) Tabela de vinculo user -> oficina
CREATE TABLE public.user_oficinas (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  oficina_id UUID REFERENCES public.oficinas(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('dono','gerente','operario','contador')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, oficina_id)
);

ALTER TABLE public.user_oficinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_oficinas FORCE ROW LEVEL SECURITY;

-- 3) Adicionar oficina_id nas tabelas existentes
ALTER TABLE public.funcionarios       ADD COLUMN oficina_id UUID REFERENCES public.oficinas(id);
ALTER TABLE public.ordens_servico     ADD COLUMN oficina_id UUID REFERENCES public.oficinas(id);
ALTER TABLE public.apontamentos       ADD COLUMN oficina_id UUID REFERENCES public.oficinas(id);
ALTER TABLE public.pontos_eletronicos ADD COLUMN oficina_id UUID REFERENCES public.oficinas(id);

-- 4) Criar Oficina Demo e associar dados existentes
DO $$
DECLARE
  demo_id UUID;
BEGIN
  INSERT INTO public.oficinas (nome, plano, status_assinatura)
  VALUES ('Oficina Demo', 'trial', 'ativa')
  RETURNING id INTO demo_id;

  UPDATE public.funcionarios       SET oficina_id = demo_id WHERE oficina_id IS NULL;
  UPDATE public.ordens_servico     SET oficina_id = demo_id WHERE oficina_id IS NULL;
  UPDATE public.apontamentos       SET oficina_id = demo_id WHERE oficina_id IS NULL;
  UPDATE public.pontos_eletronicos SET oficina_id = demo_id WHERE oficina_id IS NULL;
END $$;

-- 5) Tornar oficina_id obrigatorio (apos popular)
ALTER TABLE public.funcionarios       ALTER COLUMN oficina_id SET NOT NULL;
ALTER TABLE public.ordens_servico     ALTER COLUMN oficina_id SET NOT NULL;
ALTER TABLE public.apontamentos       ALTER COLUMN oficina_id SET NOT NULL;
ALTER TABLE public.pontos_eletronicos ALTER COLUMN oficina_id SET NOT NULL;

-- 6) Indices criticos para performance com RLS
CREATE INDEX idx_funcionarios_oficina       ON public.funcionarios(oficina_id);
CREATE INDEX idx_ordens_servico_oficina     ON public.ordens_servico(oficina_id);
CREATE INDEX idx_apontamentos_oficina       ON public.apontamentos(oficina_id);
CREATE INDEX idx_pontos_eletronicos_oficina ON public.pontos_eletronicos(oficina_id);

-- 7) Padronizar valores de etapa via CHECK constraint
ALTER TABLE public.apontamentos
  ADD CONSTRAINT chk_etapa_valida
  CHECK (etapa IS NULL OR etapa IN (
    'Orcamento','AguardandoPeca','Desmontagem','Funilaria',
    'Preparacao','Pintura','Polimento','Montagem','Qualidade','Entrega',
    'Outros'
  ));

-- 8) Policies de RLS por oficina_id (le do JWT)
CREATE POLICY "oficina_isolation_funcionarios"
  ON public.funcionarios FOR ALL TO authenticated
  USING (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid)
  WITH CHECK (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "oficina_isolation_ordens_servico"
  ON public.ordens_servico FOR ALL TO authenticated
  USING (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid)
  WITH CHECK (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "oficina_isolation_apontamentos"
  ON public.apontamentos FOR ALL TO authenticated
  USING (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid)
  WITH CHECK (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "oficina_isolation_pontos"
  ON public.pontos_eletronicos FOR ALL TO authenticated
  USING (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid)
  WITH CHECK (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "oficina_isolation_self"
  ON public.oficinas FOR ALL TO authenticated
  USING (id = (auth.jwt() ->> 'oficina_id')::uuid)
  WITH CHECK (id = (auth.jwt() ->> 'oficina_id')::uuid);

CREATE POLICY "user_ve_proprios_vinculos"
  ON public.user_oficinas FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 9) Trigger de atualizado_em na tabela oficinas
CREATE OR REPLACE FUNCTION public.set_atualizado_em()
  RETURNS TRIGGER AS $func$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_oficinas_atualizado
  BEFORE UPDATE ON public.oficinas
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
