/**
 * Camada de dados do ADMIN — núcleo PURO (tipos + constantes + helpers), SEM
 * acesso a dados.
 *
 * Por que existe (server-move, passo 1): a LEITURA das telas /admin/os e
 * /admin/funcionarios foi movida do browser para o SERVIDOR (RSC + DAL). Para NÃO
 * duplicar tipos/constantes/regras entre a versão client (admin-queries.ts) e a
 * server-side (admin-queries.server.ts), tudo que é PURO mora aqui. Este módulo:
 *   - NÃO importa client.ts nem server.ts (não toca em Supabase);
 *   - NÃO é 'server-only' nem 'use client' — roda nos dois lados;
 *   - só carrega tipos, constantes de domínio e funções puras.
 *
 * O oficina_id NUNCA é setado aqui: o trigger BEFORE INSERT da Fase 1 preenche a
 * partir do JWT, mantendo o isolamento multi-tenant. Quem grava (client, neste
 * passo) ou lê (client OU server) reusa estes mesmos tipos/constantes — sem cópia.
 */

import type { EtapaId } from './client';

/* ───────────────────────── Tipos ───────────────────────── */

export type TipoCliente = 'seguradora' | 'cooperativa' | 'particular';

/** Ciclo de vida da OS (status_geral). Lista FIXA — trava do banco na 005. */
export type StatusOS =
  | 'Aguardando Produção'
  | 'Em Produção'
  | 'Pronto para Entrega'
  | 'Entregue';

/** OS é "ativa" enquanto não foi entregue (regra da placa única-parcial). */
export const STATUS_OS: StatusOS[] = [
  'Aguardando Produção',
  'Em Produção',
  'Pronto para Entrega',
  'Entregue',
];

/** Um carro entregue sai do quadro ativo; o resto conta como ativo. PURA. */
export function osEstaAtiva(status: string | null | undefined): boolean {
  return status !== 'Entregue';
}

export type MotivoBloqueio =
  | 'aguardando_peca'
  | 'em_outro_setor'
  | 'aguardando_aprovacao'
  | 'aguardando_cura';

/** OS completa, com todos os campos finais da OS (vide CLAUDE.md). */
export type OrdemServicoAdmin = {
  id: string;
  placa: string;
  modelo_veiculo: string;
  status_geral: string | null;
  data_entrada: string | null;
  data_prometida: string | null;
  tipo_cliente: TipoCliente | null;
  valor_orcamento: number | null;
  ref_externa: string | null;
  etapa_atual: EtapaId | null;
  bloqueado: boolean;
  motivo_bloqueio: MotivoBloqueio | null;
  cliente_nome: string | null;
  cliente_whatsapp: string | null;
};

/** Funcionário como o admin vê (inclui inativos). */
export type FuncionarioAdmin = {
  id: string;
  nome: string;
  cargo: string;
  ativo: boolean;
};

export type PapelOficina = 'dono' | 'gerente' | 'operario' | 'contador';

/* ─────────────────── Constantes de domínio ─────────────────── */

/**
 * Tipos de cliente + prazo sugerido (em dias) para pré-preencher a data
 * prometida no formulário. São SUGESTÕES editáveis, não regra fixa.
 */
export const TIPOS_CLIENTE: { id: TipoCliente; nome: string; prazoSugeridoDias: number }[] = [
  { id: 'seguradora', nome: 'Seguradora', prazoSugeridoDias: 30 },
  { id: 'cooperativa', nome: 'Cooperativa', prazoSugeridoDias: 30 },
  { id: 'particular', nome: 'Particular', prazoSugeridoDias: 15 },
];

/**
 * Motivos de bloqueio com a divisão visual do escopo:
 * PROBLEMA (peça, aprovação) × FLUXO (outro setor, cura).
 */
export const MOTIVOS_BLOQUEIO: {
  id: MotivoBloqueio;
  nome: string;
  categoria: 'problema' | 'fluxo';
}[] = [
  { id: 'aguardando_peca', nome: 'Aguardando peça', categoria: 'problema' },
  { id: 'aguardando_aprovacao', nome: 'Aguardando aprovação', categoria: 'problema' },
  { id: 'em_outro_setor', nome: 'Em outro setor', categoria: 'fluxo' },
  { id: 'aguardando_cura', nome: 'Aguardando cura', categoria: 'fluxo' },
];

/** Colunas da OS lidas/escritas (única fonte — client e server iguais). */
export const COLS_OS =
  'id, placa, modelo_veiculo, status_geral, data_entrada, data_prometida, tipo_cliente, valor_orcamento, ref_externa, etapa_atual, bloqueado, motivo_bloqueio, cliente_nome, cliente_whatsapp';

/* ─────────────────── Helpers puros ─────────────────── */

/**
 * Normaliza uma placa: MAIÚSCULAS, só A-Z/0-9, sem espaços nas pontas. PURA.
 *
 * É uma cópia MÍNIMA e idêntica de queries.normalizarPlaca (coberta por testes
 * lá), inlinada aqui pelo MESMO motivo de parseISOComUTC em anomalias-shared.ts:
 * este módulo roda TAMBÉM no servidor (Server Actions), e queries.ts importa
 * hooks de React + o cliente do browser — o build do Next proíbe arrastar isso
 * para um módulo 'use server'. O totem segue usando queries.normalizarPlaca sem
 * mudança; aqui é o gêmeo puro para a escrita server-side.
 */
export function normalizarPlaca(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * Soma `dias` a uma data base (YYYY-MM-DD) e devolve YYYY-MM-DD.
 * Usado para sugerir a data prometida a partir do tipo de cliente. Sugestão
 * editável: o admin pode trocar. Base ausente -> usa hoje. PURA.
 */
export function somarDias(baseISO: string | null | undefined, dias: number): string {
  const base = baseISO ? new Date(baseISO + 'T00:00:00') : new Date();
  base.setDate(base.getDate() + dias);
  return base.toISOString().slice(0, 10);
}

/**
 * Escapa os caracteres especiais de LIKE/ILIKE (`%`, `_`, `\`) num termo de
 * busca, para que um nome como "João %" ou "a_b" seja tratado LITERALMENTE e não
 * como um padrão de wildcard. Sem isso, `.ilike(col, termo)` casaria qualquer
 * coisa quando o termo tivesse `%`/`_` — quebrando G4/G5 em silêncio. PURA.
 */
export function escaparLike(termo: string): string {
  return termo.replace(/[\\%_]/g, '\\$&');
}

/**
 * Mensagem amigável padrão quando o erro não casa nenhum padrão conhecido.
 * Evita vazar texto cru do Postgres (jargão técnico) para o admin.
 */
export const ERRO_GENERICO = 'Não foi possível concluir. Tente de novo em instantes.';

/**
 * Traduz erros do Postgres/Supabase (ou de catch) para algo legível ao admin.
 * Nunca devolve o texto cru do banco: o que não casar vira ERRO_GENERICO.
 * Mensagens já-amigáveis em PT-BR (timeout do withTimeout) passam intactas. PURA —
 * usada no client e no server (a leitura roda nos dois lados desde o server-move).
 */
export function traduzirErro(msg: string | null | undefined): string {
  if (!msg) return ERRO_GENERICO;
  const m = msg.toLowerCase();
  // Mensagens nossas (já amigáveis) que devem passar sem reescrita.
  if (m.includes('conexão demorou') || m.includes('verifique a internet')) {
    return msg;
  }
  if (m.includes('duplicate') || m.includes('unique') || m.includes('23505')) {
    return 'Já existe uma OS cadastrada com essa placa. Busque a placa antes de criar.';
  }
  if (m.includes('jwt') || m.includes('invalid api key')) {
    return 'Sessão inválida. Faça login de novo.';
  }
  if (m.includes('permission') || m.includes('rls') || m.includes('policy') || m.includes('denied')) {
    return 'Sem permissão para gravar. (Falta aplicar a Migration 004 ou fazer login como admin.)';
  }
  if (m.includes('check constraint') || m.includes('violates check')) {
    return 'Valor inválido em um dos campos (tipo de cliente, etapa ou motivo de bloqueio).';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) {
    return 'Sem conexão com o servidor. Verifique a internet.';
  }
  return ERRO_GENERICO;
}
