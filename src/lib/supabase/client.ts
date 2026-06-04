/**
 * Cliente Supabase para uso no browser (componentes "use client").
 *
 * Por que um arquivo separado?
 * - Singleton: evita criar um client novo a cada render.
 * - Trocar de chave (anon -> service_role) em um único lugar no futuro.
 * - Permite injetar logging/telemetria sem espalhar pelo app.
 *
 * SESSÃO EM COOKIE (Passo 0 do server-move): usamos `createBrowserClient` do
 * `@supabase/ssr`. A sessão sai do localStorage e passa a viver em COOKIE — é
 * o que permite o SERVIDOR (RSC/Server Actions/proxy) ler a mesma sessão e
 * autenticar como o usuário, mantendo o RLS isolando por oficina_id SEM código
 * extra. A API PÚBLICA daqui (getSupabase + tipos/constantes) NÃO muda: os
 * queries e gates continuam chamando getSupabase().auth.* e .from(...) igual.
 *
 * Sem custom cookie store: no browser, o `@supabase/ssr` lê/grava via
 * `document.cookie` automaticamente quando `cookies` não é passado. Por isso os
 * usuários re-logam uma vez (a sessão antiga vivia no localStorage) — esperado.
 */

import { createBrowserClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[GDelta] Variáveis NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes. Verifique o .env.local e reinicie o dev server (Ctrl+C e npm run dev).'
  );
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  // createBrowserClient já é singleton por padrão (isSingleton), mas mantemos o
  // nosso cache em módulo para preservar exatamente o contrato anterior.
  // persistSession/autoRefreshToken seguem ligados: a sessão do device (oficina)
  // persiste no kiosk e se renova sozinha — é ela que carrega o oficina_id no
  // JWT (Fase 1), usado pelo RLS e pelos triggers de oficina_id nas escritas.
  // A diferença é o armazenamento: agora COOKIE (via document.cookie), não
  // localStorage — para o servidor poder ler a mesma sessão.
  _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: { 'x-client-info': 'gdelta-totem/1.0' },
    },
  });
  return _client;
}

// ---------- Tipos das tabelas (espelham seu schema real) ----------

export type Funcionario = {
  id: string;
  nome: string;
  matricula?: string | null;
  ativo: boolean;
  cargo?: string | null;
};

export type OrdemServico = {
  id: string;
  placa: string;
  modelo_veiculo: string;
  status_geral?: string | null;
  data_entrada?: string | null;
};

export type StatusTarefa = 'Em andamento' | 'Pausado' | 'Finalizado';

export type Apontamento = {
  id: string;
  ordem_servico_id: string;
  nome_funcionario: string;
  cargo_funcionario: string;
  hora_inicio: string;
  hora_fim: string | null;
  status_tarefa: StatusTarefa | string;
  etapa?: string | null;
  motivo_pausa?: string | null;
  pausado_em?: string | null;
  tempo_pausado_seg?: number | null;
  retrabalho?: boolean | null;
  complexidade?: ComplexidadeId | string | null;
  etapa_concluida?: boolean | null;
};

export type ApontamentoComOS = Apontamento & {
  ordem_servico: OrdemServico | null;
};

// ---------- Complexidade da tarefa (escopo TRAVADO do MVP) ----------
// Escala unica de 3 niveis em TODO apontamento; 'simples' pre-selecionado
// (zero toque extra). Guardada em ASCII ('medio'); a UI exibe "Médio".
export type ComplexidadeId = 'simples' | 'medio' | 'complexo';

export type ComplexidadeInfo = {
  id: ComplexidadeId;
  nome: string;
  icone: string;
};

export const COMPLEXIDADE_PADRAO: ComplexidadeId = 'simples';

export const COMPLEXIDADES: ComplexidadeInfo[] = [
  { id: 'simples', nome: 'Simples', icone: '○' },
  { id: 'medio', nome: 'Médio', icone: '◐' },
  { id: 'complexo', nome: 'Complexo', icone: '●' },
];

// ---------- Etapas operacionais (Fase 2) ----------

export type EtapaId =
  | 'Desmontagem'
  | 'Funilaria'
  | 'Preparacao'
  | 'Pintura'
  | 'Polimento'
  | 'Montagem'
  | 'Qualidade'
  | 'Entrega';

export type EtapaInfo = {
  id: EtapaId;
  nome: string;
  icone: string;
  descricao: string;
  ordem: number;
};

export const ETAPAS: EtapaInfo[] = [
  {
    id: 'Desmontagem',
    nome: 'Desmontagem',
    icone: '⚙',
    descricao: 'Remover peças e analisar danos',
    ordem: 1,
  },
  { id: 'Funilaria', nome: 'Funilaria', icone: '🔨', descricao: 'Conserto da lataria', ordem: 2 },
  {
    id: 'Preparacao',
    nome: 'Preparação',
    icone: '✨',
    descricao: 'Lixar, mascarar, preparar superfícies',
    ordem: 3,
  },
  { id: 'Pintura', nome: 'Pintura', icone: '🎨', descricao: 'Aplicação da tinta', ordem: 4 },
  { id: 'Polimento', nome: 'Polimento', icone: '💎', descricao: 'Acabamento e brilho', ordem: 5 },
  { id: 'Montagem', nome: 'Montagem', icone: '🔧', descricao: 'Recolocar peças', ordem: 6 },
  {
    id: 'Qualidade',
    nome: 'Análise de Qualidade',
    icone: '🔍',
    descricao: 'Checagem final antes da entrega',
    ordem: 7,
  },
  {
    id: 'Entrega',
    nome: 'Entrega ao Cliente',
    icone: '🚗',
    descricao: 'Cliente busca o carro',
    ordem: 8,
  },
];

export function buscarEtapa(id: string | null | undefined): EtapaInfo | null {
  if (!id) return null;
  return ETAPAS.find((e) => e.id === id) ?? null;
}

// ---------- Motivos de pausa (Fase 4) ----------

export type MotivoPausaId =
  | 'secagem'
  | 'falta_peca'
  | 'problema_tecnico'
  | 'orcamento_extra'
  | 'almoco'
  | 'fim_expediente';

export type MotivoPausaInfo = {
  id: MotivoPausaId;
  nome: string;
  icone: string;
  descricao: string;
  categoria: 'tecnica' | 'pessoal';
  alerta?: boolean;
};

export const MOTIVOS_PAUSA: MotivoPausaInfo[] = [
  {
    id: 'secagem',
    nome: 'Tempo de secagem/cura',
    icone: '⏳',
    descricao: 'Carro precisa esperar tinta secar, massa curar, etc.',
    categoria: 'tecnica',
  },
  {
    id: 'falta_peca',
    nome: 'Faltou peça ou material',
    icone: '📦',
    descricao: 'Aguardando peça do estoque ou compras',
    categoria: 'tecnica',
    alerta: true,
  },
  {
    id: 'problema_tecnico',
    nome: 'Problema técnico',
    icone: '🛠',
    descricao: 'Ferramenta quebrou, falta luz, ar comprimido, etc.',
    categoria: 'tecnica',
  },
  {
    id: 'orcamento_extra',
    nome: 'Aguardando orçamento extra',
    icone: '💰',
    descricao: 'Descobriu serviço a mais, esperando aprovação',
    categoria: 'tecnica',
  },
  {
    id: 'almoco',
    nome: 'Almoço / refeição',
    icone: '🍽',
    descricao: 'Pausa para refeição',
    categoria: 'pessoal',
  },
  {
    id: 'fim_expediente',
    nome: 'Fim do expediente',
    icone: '🌅',
    descricao: 'Vou retomar amanhã',
    categoria: 'pessoal',
  },
];

export function buscarMotivoPausa(id: string | null | undefined): MotivoPausaInfo | null {
  if (!id) return null;
  return MOTIVOS_PAUSA.find((m) => m.id === id) ?? null;
}

