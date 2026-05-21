/**
 * Cliente Supabase para uso no browser (componentes "use client").
 *
 * Por que um arquivo separado?
 * - Singleton: evita criar um client novo a cada render.
 * - Trocar de chave (anon -> service_role) em um único lugar no futuro.
 * - Permite injetar logging/telemetria sem espalhar pelo app.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[GDelta] Variáveis NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes. Verifique o .env.local e reinicie o dev server (Ctrl+C e npm run dev).",
  );
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { "x-client-info": "gdelta-totem/1.0" },
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

export type StatusTarefa = "Em andamento" | "Pausado" | "Finalizado";

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
};

export type ApontamentoComOS = Apontamento & {
  ordem_servico: OrdemServico | null;
};

// ---------- Etapas operacionais (Fase 2) ----------

export type EtapaId =
  | "Desmontagem"
  | "Funilaria"
  | "Preparacao"
  | "Pintura"
  | "Polimento"
  | "Montagem"
  | "Qualidade"
  | "Entrega";

export type EtapaInfo = {
  id: EtapaId;
  nome: string;
  icone: string;
  descricao: string;
  ordem: number;
};

export const ETAPAS: EtapaInfo[] = [
  { id: "Desmontagem", nome: "Desmontagem", icone: "⚙", descricao: "Remover peças e analisar danos", ordem: 1 },
  { id: "Funilaria", nome: "Funilaria", icone: "🔨", descricao: "Conserto da lataria", ordem: 2 },
  { id: "Preparacao", nome: "Preparação", icone: "✨", descricao: "Lixar, mascarar, preparar superfícies", ordem: 3 },
  { id: "Pintura", nome: "Pintura", icone: "🎨", descricao: "Aplicação da tinta", ordem: 4 },
  { id: "Polimento", nome: "Polimento", icone: "💎", descricao: "Acabamento e brilho", ordem: 5 },
  { id: "Montagem", nome: "Montagem", icone: "🔧", descricao: "Recolocar peças", ordem: 6 },
  { id: "Qualidade", nome: "Análise de Qualidade", icone: "🔍", descricao: "Checagem final antes da entrega", ordem: 7 },
  { id: "Entrega", nome: "Entrega ao Cliente", icone: "🚗", descricao: "Cliente busca o carro", ordem: 8 },
];

export function buscarEtapa(id: string | null | undefined): EtapaInfo | null {
  if (!id) return null;
  return ETAPAS.find((e) => e.id === id) ?? null;
}

// ---------- Motivos de pausa (Fase 4) ----------

export type MotivoPausaId =
  | "secagem"
  | "falta_peca"
  | "problema_tecnico"
  | "orcamento_extra"
  | "almoco"
  | "fim_expediente";

export type MotivoPausaInfo = {
  id: MotivoPausaId;
  nome: string;
  icone: string;
  descricao: string;
  categoria: "tecnica" | "pessoal";
  alerta?: boolean;
};

export const MOTIVOS_PAUSA: MotivoPausaInfo[] = [
  {
    id: "secagem",
    nome: "Tempo de secagem/cura",
    icone: "⏳",
    descricao: "Carro precisa esperar tinta secar, massa curar, etc.",
    categoria: "tecnica",
  },
  {
    id: "falta_peca",
    nome: "Faltou peça ou material",
    icone: "📦",
    descricao: "Aguardando peça do estoque ou compras",
    categoria: "tecnica",
    alerta: true,
  },
  {
    id: "problema_tecnico",
    nome: "Problema técnico",
    icone: "🛠",
    descricao: "Ferramenta quebrou, falta luz, ar comprimido, etc.",
    categoria: "tecnica",
  },
  {
    id: "orcamento_extra",
    nome: "Aguardando orçamento extra",
    icone: "💰",
    descricao: "Descobriu serviço a mais, esperando aprovação",
    categoria: "tecnica",
  },
  {
    id: "almoco",
    nome: "Almoço / refeição",
    icone: "🍽",
    descricao: "Pausa para refeição",
    categoria: "pessoal",
  },
  {
    id: "fim_expediente",
    nome: "Fim do expediente",
    icone: "🌅",
    descricao: "Vou retomar amanhã",
    categoria: "pessoal",
  },
];

export function buscarMotivoPausa(id: string | null | undefined): MotivoPausaInfo | null {
  if (!id) return null;
  return MOTIVOS_PAUSA.find((m) => m.id === id) ?? null;
}

// ---------- Ponto Eletrônico (Fase 5) ----------

export type TipoPontoId =
  | "entrada"
  | "almoco_saida"
  | "almoco_volta"
  | "fim_expediente";

export type TipoPontoInfo = {
  id: TipoPontoId;
  nome: string;
  icone: string;
  descricao: string;
  cor: "ok" | "warn" | "info" | "danger";
  ordem: number;
};

export const TIPOS_PONTO: TipoPontoInfo[] = [
  {
    id: "entrada",
    nome: "ENTRADA",
    icone: "▶",
    descricao: "Cheguei pra trabalhar",
    cor: "ok",
    ordem: 1,
  },
  {
    id: "almoco_saida",
    nome: "SAIR PRO ALMOÇO",
    icone: "🍽",
    descricao: "Saída pro almoço",
    cor: "warn",
    ordem: 2,
  },
  {
    id: "almoco_volta",
    nome: "VOLTAR DO ALMOÇO",
    icone: "▶",
    descricao: "Voltei do almoço",
    cor: "info",
    ordem: 3,
  },
  {
    id: "fim_expediente",
    nome: "FIM DO EXPEDIENTE",
    icone: "🌅",
    descricao: "Vou embora, até amanhã",
    cor: "danger",
    ordem: 4,
  },
];

export function buscarTipoPonto(id: string | null | undefined): TipoPontoInfo | null {
  if (!id) return null;
  return TIPOS_PONTO.find((t) => t.id === id) ?? null;
}

export type RegistroPonto = {
  id: string;
  nome_funcionario: string;
  cargo_funcionario?: string | null;
  tipo: TipoPontoId | string;
  registrado_em: string;
  observacao?: string | null;
};

/**
 * Resumo do dia de um funcionário, calculado a partir dos batimentos.
 * Usado para decidir qual botão de ponto está disponível no totem.
 */
export type SituacaoPonto = {
  entrada: RegistroPonto | null;
  almoco_saida: RegistroPonto | null;
  almoco_volta: RegistroPonto | null;
  fim_expediente: RegistroPonto | null;
  proximoBatimentoPermitido: TipoPontoId | null; // qual o próximo botão habilitado
};
