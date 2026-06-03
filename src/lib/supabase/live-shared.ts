/**
 * Visão Operacional AO VIVO — núcleo PURO (tipos + montagem do kanban), SEM
 * acesso a dados.
 *
 * Por que existe (server-move, passo 1): a LEITURA da tela /admin/producao foi
 * movida do browser para o SERVIDOR (RSC + DAL). Para NÃO duplicar a regra de
 * negócio entre a versão client (live-queries.ts) e a server-side
 * (live-queries.server.ts), toda a LÓGICA pura — agrupar apontamentos ativos por
 * OS, montar os carros com situação, distribuir nas 8 colunas do kanban, derivar
 * os 3 estados do operário e o resumo — mora aqui. Este módulo:
 *   - NÃO importa client.ts nem queries.ts (não toca em Supabase nem em hooks de
 *     React); por isso o build pode arrastá-lo para um Server Component;
 *   - NÃO é 'server-only' nem 'use client' — roda nos dois lados;
 *   - só faz contas a partir das linhas já buscadas (OSRow[]/ApontRow[]/…).
 *
 * Quem busca o dado (client OU server) chama montarVisaoLive(oss, apont, apHoje)
 * e recebe a MESMA VisaoLive. A regra de negócio é IDÊNTICA aos dois — sem cópia.
 *
 * Responde às 2 perguntas do dono (CLAUDE.md):
 *   1. "Todo mundo está produzindo agora?"  -> os 3 estados do operário.
 *   2. "Que carro está travado/lento?"      -> kanban por etapa + bloqueios.
 *
 * Tempos ancorados no relógio do servidor (hora_inicio/registrado_em vêm do banco).
 */

/* ─────────────────── Etapas do kanban (inline, sem client.ts) ───────────────────
 * As 8 colunas do kanban são as 8 etapas do código. O id/nome vivem AQUI inline
 * (em vez de importar de client.ts) porque este módulo roda TAMBÉM no servidor, e
 * client.ts cria o cliente do browser no topo do módulo (createBrowserClient, que
 * lê env públicos e lança se faltarem) — o build do Next proíbe arrastar isso para
 * um Server Component. O EtapaId é o MESMO union de client.ts (literais idênticos,
 * estruturalmente compatível). É o mesmo padrão de dono-shared/anomalias-shared.
 */
export type EtapaId =
  | 'Desmontagem'
  | 'Funilaria'
  | 'Preparacao'
  | 'Pintura'
  | 'Polimento'
  | 'Montagem'
  | 'Qualidade'
  | 'Entrega';

/** Colunas do kanban = as 8 etapas, na ordem do código (CLAUDE.md). */
export const ETAPAS_KANBAN: { id: EtapaId; nome: string }[] = [
  { id: 'Desmontagem', nome: 'Desmontagem' },
  { id: 'Funilaria', nome: 'Funilaria' },
  { id: 'Preparacao', nome: 'Preparação' },
  { id: 'Pintura', nome: 'Pintura' },
  { id: 'Polimento', nome: 'Polimento' },
  { id: 'Montagem', nome: 'Montagem' },
  { id: 'Qualidade', nome: 'Análise de Qualidade' },
  { id: 'Entrega', nome: 'Entrega ao Cliente' },
];

// Higiene (#7): a LEITURA nunca expõe erro cru do Postgres (RLS/SQL/estrutura) na UI.
export const MSG_FALHA_LIVE =
  'Não foi possível carregar a visão ao vivo agora. Tente de novo.';

/* ─────────────────── Status considerados ATIVOS ─────────────────── */
/** Status de tarefa considerados ATIVOS (mesmo critério do totem/anomalias). */
export const STATUS_ATIVOS_LIVE = ['Em andamento', 'Pausado'] as const;

/** Ações de correção que ENCERRAM o apontamento (não ressuscitam como fantasma). */
export const ACOES_ENCERRANTES_LIVE = ['ajustar_fim', 'descartar'] as const;

/* ─────────────────── Colunas lidas (única fonte: client e server iguais) ─────────────────── */
export const COLS_OS_LIVE =
  'id, placa, modelo_veiculo, status_geral, data_entrada, data_prometida, etapa_atual, bloqueado, motivo_bloqueio';
export const COLS_APONT_LIVE =
  'id, ordem_servico_id, nome_funcionario, cargo_funcionario, hora_inicio, status_tarefa, etapa, motivo_pausa';
export const COLS_APONT_HOJE_LIVE =
  'nome_funcionario, cargo_funcionario, status_tarefa, hora_inicio';

/* ───────────────────────── Tipos ───────────────────────── */

/** Os 3 estados do operário no painel (produtividade-only, sem presença). */
export type EstadoOperario = 'produzindo' | 'em_pausa' | 'sem_tarefa';

export type OperarioLive = {
  nome: string;
  cargo: string | null;
  estado: EstadoOperario;
  /** Placa do carro em que está trabalhando agora (se produzindo/pausado). */
  placaAtual: string | null;
  etapaAtual: string | null;
  /** Motivo da pausa, quando em_pausa. */
  motivoPausa: string | null;
  /** Início do apontamento ativo (âncora do cronômetro), ISO do servidor. */
  desdeISO: string | null;
};

/** Um apontamento ativo num carro (para mostrar TODOS no card do kanban). */
export type ApontamentoAtivo = {
  id: string;
  nome_funcionario: string;
  cargo_funcionario: string | null;
  etapa: string | null;
  status_tarefa: string;
  hora_inicio: string;
  motivo_pausa: string | null;
};

/** Um carro no kanban: a OS + apontamentos ativos nela. */
export type CarroLive = {
  id: string;
  placa: string;
  modelo_veiculo: string;
  status_geral: string | null;
  data_entrada: string | null;
  data_prometida: string | null;
  etapa_atual: EtapaId | null;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  ativos: ApontamentoAtivo[];
  /** 'trabalhando' | 'aguardando' (etapa concluída) | 'bloqueado'. */
  situacao: 'trabalhando' | 'aguardando' | 'bloqueado';
};

export type VisaoLive = {
  carros: CarroLive[];
  operarios: OperarioLive[];
  /** Carros agrupados por etapa do kanban (8 colunas fixas). */
  colunas: { etapa: EtapaId; nome: string; carros: CarroLive[] }[];
  resumo: {
    produzindo: number;
    em_pausa: number;
    sem_tarefa: number;
    carrosAtivos: number;
    carrosBloqueados: number;
  };
};

/** Forma das linhas de OS vindas da query (mesma seleção no client e no server). */
export type OSRowLive = {
  id: string;
  placa: string;
  modelo_veiculo: string;
  status_geral: string | null;
  data_entrada: string | null;
  data_prometida: string | null;
  etapa_atual: EtapaId | null;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
};

/** Forma das linhas de apontamento ATIVO (mesma seleção no client e no server). */
export type ApontRowLive = {
  id: string;
  ordem_servico_id: string;
  nome_funcionario: string;
  cargo_funcionario: string | null;
  hora_inicio: string;
  status_tarefa: string;
  etapa: string | null;
  motivo_pausa: string | null;
};

/** Forma das linhas de "apontou hoje" (qualquer status). */
export type ApontHojeRowLive = {
  nome_funcionario: string;
  cargo_funcionario: string | null;
  status_tarefa: string;
  hora_inicio: string;
};

/* ───────────────────── helpers de data ───────────────────── */

/** Início do dia de HOJE em ISO (corte para "apontou hoje"). */
export function inicioDeHojeISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ───────────────────── montagem pura da visão ───────────────────── */

/**
 * Monta a VisaoLive completa a partir das linhas já buscadas. Função PURA: mesma
 * saída para a mesma entrada, sem I/O. É o coração compartilhado entre a leitura
 * client e a server-side.
 *
 * @param oss      OS ativas (não entregues).
 * @param apont    apontamentos ATIVOS (Em andamento/Pausado) JÁ filtrados dos
 *                 fantasmas com correção encerrante (a exclusão §4 é feita por
 *                 quem busca, pois depende de uma 2ª query — ver as duas leituras).
 * @param apHoje   apontamentos de HOJE (qualquer status) → quem trabalhou hoje.
 */
export function montarVisaoLive(
  oss: OSRowLive[] | null | undefined,
  apont: ApontRowLive[] | null | undefined,
  apHoje: ApontHojeRowLive[] | null | undefined
): VisaoLive {
  const oss_ = oss ?? [];
  const apont_ = apont ?? [];
  const apHoje_ = apHoje ?? [];

  // 1) apontamentos ativos por OS
  const ativosPorOS = new Map<string, ApontamentoAtivo[]>();
  for (const a of apont_) {
    const lista = ativosPorOS.get(a.ordem_servico_id) ?? [];
    lista.push({
      id: a.id,
      nome_funcionario: a.nome_funcionario,
      cargo_funcionario: a.cargo_funcionario,
      etapa: a.etapa,
      status_tarefa: a.status_tarefa,
      hora_inicio: a.hora_inicio,
      motivo_pausa: a.motivo_pausa,
    });
    ativosPorOS.set(a.ordem_servico_id, lista);
  }

  // 2) carros (OS ativas) com situação
  const carros: CarroLive[] = oss_.map((os) => {
    const ativos = ativosPorOS.get(os.id) ?? [];
    const algumTrabalhando = ativos.some((x) => x.status_tarefa === 'Em andamento');
    const situacao: CarroLive['situacao'] = os.bloqueado
      ? 'bloqueado'
      : algumTrabalhando
        ? 'trabalhando'
        : 'aguardando';
    return { ...os, ativos, situacao };
  });

  // 3) colunas do kanban = 8 etapas fixas
  const colunas = ETAPAS_KANBAN.map((et) => ({
    etapa: et.id,
    nome: et.nome,
    carros: carros.filter((c) => c.etapa_atual === et.id),
  }));

  // 4) os 3 estados do operário — SEM presença/ponto.
  //    A faixa mostra só quem TEVE apontamento hoje (ou tem um ativo agora),
  //    derivado de apontamentos — nunca a lista inteira de funcionários.
  const placaPorOSId = new Map(oss_.map((o) => [o.id, o.placa]));

  // apontamento ATIVO por operário (o mais recente) -> produzindo / em_pausa
  const ativoPorOperario = new Map<string, ApontRowLive>();
  for (const a of apont_)
    if (!ativoPorOperario.has(a.nome_funcionario)) ativoPorOperario.set(a.nome_funcionario, a);

  // operários da faixa = união de "ativo agora" + "teve apontamento hoje"
  const cargoPorOperario = new Map<string, string | null>();
  for (const a of apHoje_)
    if (!cargoPorOperario.has(a.nome_funcionario))
      cargoPorOperario.set(a.nome_funcionario, a.cargo_funcionario);
  for (const a of apont_)
    if (!cargoPorOperario.has(a.nome_funcionario))
      cargoPorOperario.set(a.nome_funcionario, a.cargo_funcionario);

  const operarios: OperarioLive[] = [...cargoPorOperario.keys()].map((nome) => {
    const ap = ativoPorOperario.get(nome);
    let estado: EstadoOperario;
    if (ap && ap.status_tarefa === 'Em andamento') estado = 'produzindo';
    else if (ap && ap.status_tarefa === 'Pausado') estado = 'em_pausa';
    else estado = 'sem_tarefa';

    return {
      nome,
      cargo: cargoPorOperario.get(nome) ?? null,
      estado,
      placaAtual: ap ? (placaPorOSId.get(ap.ordem_servico_id) ?? null) : null,
      etapaAtual: ap?.etapa ?? null,
      motivoPausa: estado === 'em_pausa' ? (ap?.motivo_pausa ?? null) : null,
      desdeISO: ap?.hora_inicio ?? null,
    };
  });

  const resumo = {
    produzindo: operarios.filter((o) => o.estado === 'produzindo').length,
    em_pausa: operarios.filter((o) => o.estado === 'em_pausa').length,
    sem_tarefa: operarios.filter((o) => o.estado === 'sem_tarefa').length,
    carrosAtivos: carros.length,
    carrosBloqueados: carros.filter((c) => c.bloqueado).length,
  };

  return { carros, operarios, colunas, resumo };
}

/**
 * Exclui dos apontamentos ATIVOS os que já têm correção encerrante na trilha
 * (§4 do plano: não ressuscitar fantasmas já corrigidos). PURA — recebe as linhas
 * de correção já buscadas. Sem isso, um fantasma corrigido reapareceria como
 * "produzindo" na faixa e como apontamento ativo no card do kanban.
 */
export function excluirCorrigidos(
  apont: ApontRowLive[],
  correcoes: { apontamento_id: string }[] | null | undefined
): ApontRowLive[] {
  const encerrados = new Set((correcoes ?? []).map((c) => c.apontamento_id));
  if (encerrados.size === 0) return apont;
  return apont.filter((a) => !encerrados.has(a.id));
}

/** Rótulos amigáveis dos 3 estados, para a UI. */
export const ESTADO_LABEL: Record<EstadoOperario, { texto: string; cor: string }> = {
  produzindo: { texto: 'Produzindo', cor: '#1b7a3d' },
  em_pausa: { texto: 'Em pausa', cor: '#b8860b' },
  sem_tarefa: { texto: 'Sem tarefa ativa', cor: '#13678d' },
};
