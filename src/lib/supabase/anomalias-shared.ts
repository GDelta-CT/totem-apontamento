/**
 * Anomalias de apontamento — núcleo PURO (tipos + cálculo), SEM acesso a dados.
 *
 * Por que existe (server-move, passo 1): a LEITURA da tela /admin/anomalias foi
 * movida do browser para o SERVIDOR (RSC + DAL). Para NÃO duplicar a regra de
 * negócio entre a versão client (anomalias-queries.ts) e a server-side
 * (anomalias-queries.server.ts), toda a LÓGICA pura — classificar o que passou do
 * teto anti-fantasma, calcular as horas decorridas, achatar a junção da OS e
 * excluir os fantasmas já corrigidos — mora aqui. Este módulo:
 *   - NÃO importa client.ts nem server.ts (não toca em Supabase);
 *   - NÃO é 'server-only' nem 'use client' — roda nos dois lados;
 *   - só faz contas a partir das linhas já buscadas (RowAnomalia[] / linhas de
 *     correção).
 *
 * Quem busca o dado (client OU server) chama montarAnomalias(rows, agora) e
 * filtrarCorrigidas(anomalias, correcoes) e recebe a mesma saída. A regra de
 * negócio é IDÊNTICA aos dois — não há cópia.
 *
 * Teto anti-fantasma (CLAUDE.md): apontamento ativo muito acima de ~10,5h é
 * anomalia para o admin corrigir. Tempos ancorados no relógio do servidor.
 */

/**
 * Converte um timestamp do banco em epoch ms tratando-o como UTC. Função PURA,
 * sem dependências — inlinada aqui (em vez de importar de queries.ts) porque este
 * módulo roda TAMBÉM no servidor: queries.ts importa hooks de React (useState…) e
 * o cliente do browser, o que o build do Next proíbe arrastar para um Server
 * Component. A mesma lógica vive em queries.parseISOComUTC (usada no totem) e é
 * coberta por testes lá; aqui é uma cópia mínima e idêntica, intencional (o mesmo
 * padrão já usado em dono-shared.ts).
 *
 * O Postgres grava `timestamp` SEM 'Z'; sem isso o JS interpretaria como hora
 * local e erraria o cálculo pelo offset do fuso.
 */
function parseISOComUTC(iso: string): number {
  const isoComUTC =
    iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z';
  return new Date(isoComUTC).getTime();
}

/** Teto anti-fantasma: 10,5h em milissegundos. */
export const TETO_FANTASMA_MS = 10.5 * 60 * 60 * 1000;

/** Status de tarefa considerados ATIVOS (mesmo critério do totem). */
export const STATUS_ATIVOS = ['Em andamento', 'Pausado'] as const;

/** Ações de correção que ENCERRAM o apontamento (não ressuscitam como fantasma). */
export const ACOES_ENCERRANTES = ['ajustar_fim', 'descartar'] as const;

// Higiene (#7): a LEITURA nunca expõe erro cru do Postgres (RLS/SQL/estrutura) na UI.
export const MSG_FALHA_LEITURA =
  'Não foi possível carregar as anomalias agora. Tente de novo.';

export type AcaoCorrecao = 'ajustar_fim' | 'descartar' | 'confirmar';
export type MotivoCodigo = 'esqueceu_parar' | 'saiu_sem_registrar' | 'erro_toque' | 'outro';

export type Anomalia = {
  id: string;
  nome_funcionario: string;
  cargo_funcionario: string | null;
  etapa: string | null;
  status_tarefa: string;
  hora_inicio: string;
  /** Horas decorridas desde o início (relógio do servidor no momento da leitura). */
  horasDecorridas: number;
  placa: string | null;
  modelo: string | null;
};

/** Forma das linhas vindas da query (mesma seleção no client e no server). */
export type RowAnomalia = {
  id: string;
  nome_funcionario: string;
  cargo_funcionario: string | null;
  etapa: string | null;
  status_tarefa: string;
  hora_inicio: string;
  ordem_servico:
    | { placa: string; modelo_veiculo: string }
    | { placa: string; modelo_veiculo: string }[]
    | null;
};

/** Colunas (com a junção da OS) lidas para as anomalias — única fonte. */
export const COLS_ANOMALIAS =
  'id, nome_funcionario, cargo_funcionario, etapa, status_tarefa, hora_inicio, ordem_servico:ordens_servico(placa, modelo_veiculo)';

/**
 * Classifica e monta as anomalias a partir das linhas de apontamentos ATIVOS.
 * Mantém só os que passaram do teto anti-fantasma e calcula horasDecorridas
 * contra `agora` (relógio do servidor, passado por quem chama). Função PURA:
 * mesma saída para a mesma entrada, sem I/O. É o coração compartilhado entre a
 * leitura client e a server-side.
 */
export function montarAnomalias(
  rows: RowAnomalia[] | null | undefined,
  agora: number
): Anomalia[] {
  return (rows ?? [])
    // só os que passaram do teto anti-fantasma (datas do banco são UTC sem 'Z')
    .filter((r) => agora - parseISOComUTC(r.hora_inicio) > TETO_FANTASMA_MS)
    .map((r) => {
      const decorridoMs = agora - parseISOComUTC(r.hora_inicio);
      const os = Array.isArray(r.ordem_servico) ? r.ordem_servico[0] : r.ordem_servico;
      return {
        id: r.id,
        nome_funcionario: r.nome_funcionario,
        cargo_funcionario: r.cargo_funcionario,
        etapa: r.etapa,
        status_tarefa: r.status_tarefa,
        hora_inicio: r.hora_inicio,
        horasDecorridas: decorridoMs / (60 * 60 * 1000),
        placa: os?.placa ?? null,
        modelo: os?.modelo_veiculo ?? null,
      };
    });
}

/**
 * Exclui as anomalias cujo apontamento já tem correção encerrante na trilha
 * (§4 do PLANO: não ressuscitar fantasmas já corrigidos). PURA — recebe as
 * linhas de correção já buscadas. Função usada igual no client e no server.
 */
export function filtrarCorrigidas(
  anomalias: Anomalia[],
  correcoes: { apontamento_id: string }[] | null | undefined
): Anomalia[] {
  const encerrados = new Set((correcoes ?? []).map((c) => c.apontamento_id));
  return anomalias.filter((a) => !encerrados.has(a.id));
}

/**
 * Traduz erro de gravação para algo legível ao admin (sem jargão técnico).
 * PURA — usada no client e no server. Mantém EXATAMENTE as mesmas mensagens da
 * versão anterior (anomalias-queries.traduzirErro).
 */
export function traduzirErroAnomalia(msg: string): string {
  const m = msg.toLowerCase();
  if (
    m.includes('permission') ||
    m.includes('denied') ||
    m.includes('row-level') ||
    m.includes('policy')
  ) {
    return 'Sem permissão para corrigir. Confirme que você entrou como gerente/dono desta oficina.';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('timeout') || m.includes('demorou')) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  }
  return 'Não foi possível registrar a correção agora. Tente de novo.';
}
