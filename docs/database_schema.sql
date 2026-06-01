-- Script SQL para Supabase/PostgreSQL - G Delta

-- 1. Tabela de Funcionários (Controle de Níveis e Comportamento)
CREATE TABLE funcionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    cargo VARCHAR(50) NOT NULL, 
    nivel_acesso VARCHAR(1) NOT NULL CHECK (nivel_acesso IN ('A', 'B', 'C')), 
    ativo BOOLEAN DEFAULT TRUE,
    data_cadastro TIMESTAMP DEFAULT NOW()
);

-- 2. Tabela de Ordens de Serviço (Fluxo de Veículos)
CREATE TABLE ordens_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa VARCHAR(7) UNIQUE NOT NULL,
    modelo_veiculo VARCHAR(100) NOT NULL,
    status_geral VARCHAR(50) DEFAULT 'Aguardando Produção',
    data_entrada TIMESTAMP DEFAULT NOW()
);

-- 3. Tabela de Catálogo de Tarefas (Fragmentação POP)
CREATE TABLE tarefas_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setor VARCHAR(50) NOT NULL, 
    nome_tarefa VARCHAR(100) NOT NULL,
    nivel_exigido VARCHAR(1) NOT NULL CHECK (nivel_exigido IN ('A', 'B', 'C')),
    tempo_padrao_minutos INTEGER 
);

-- 4. Tabela de Apontamentos (O Coração do Rastreamento)
CREATE TABLE apontamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID REFERENCES ordens_servico(id),
    funcionario_id UUID REFERENCES funcionarios(id),
    tarefa_id UUID REFERENCES tarefas_catalogo(id),
    status_tarefa VARCHAR(30) DEFAULT 'Iniciada', 
    hora_inicio TIMESTAMP DEFAULT NOW(),
    hora_fim TIMESTAMP,
    aprovado_por UUID REFERENCES funcionarios(id), 
    observacoes TEXT
);
