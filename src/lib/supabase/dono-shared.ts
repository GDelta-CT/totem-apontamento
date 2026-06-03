/**
 * Painel do DONO — núcleo PURO (tipos + cálculo), SEM acesso a dados.
 *
 * Por que existe (server-move, passo 1): a leitura do painel de prazos foi
 * movida do browser para o SERVIDOR (RSC + DAL). Para NÃO duplicar a regra de
 * negócio entre a versão client (dono-queries.ts) e a server-side
 * (dono-queries.server.ts), toda a LÓGICA pura — derivar saúde de prazo, montar
 * os KPIs e ordenar por urgência — mora aqui. Este módulo:
 *   - NÃO importa client.ts nem server.ts (não toca em Supabase);
 *   - NÃO é 'server-only' nem 'use client' — roda nos dois lados;
 *   - só faz contas a partir das linhas já buscadas (OSRow[]).
 *
 * Quem busca o dado (client OU server) chama montarPainelDono(rows) e recebe o
 * mesmo PainelDono. A regra de negócio é IDÊNTICA aos dois — não há cópia.
 *
 * Vocabulário de KPI (CLAUDE.md / pesquisa de domínio): Tempo de Ciclo
 * (key-to-key) = "dias na oficina"; Ticket Médio = média de valor_orcamento.
 * NÃO é ROI de hora-homem (fast-follow, fora do MVP) — só dado real.
 */

/** Janela de "perto de estourar": faltam ≤ N dias para o prazo. */
export const DIAS_ALERTA_PRAZO = 3;
const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * Converte um timestamp do banco em epoch ms tratando-o como UTC. Função PURA,
 * sem dependências — inlinada aqui (em vez de importar de queries.ts) porque este
 * módulo roda TAMBÉM no servidor: queries.ts importa hooks de React (useState…) e
 * o cliente do browser, o que o build do Next proíbe arrastar para um Server
 * Component. A mesma lógica vive em queries.parseISOComUTC (usada no totem) e é
 * coberta por testes lá; aqui é uma cópia mínima e idêntica, intencional.
 *
 * O Postgres grava `timestamp` SEM 'Z'; sem isso o JS interpretaria como hora
 * local e erraria o cálculo pelo offset do fuso.
 */
function parseISOComUTC(iso: string): number {
  const isoComUTC =
    iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z';
  return new Date(isoComUTC).getTime();
}

/** Situação de prazo de um carro. */
export type SaudePrazo = 'no_prazo' | 'perto' | 'estourado' | 'sem_prazo';

export type CarroPrazo = {
  id: string;
  placa: string;
  modelo: string;
  tipo_cliente: string | null;
  valor_orcamento: number | null;
  data_entrada: string | null;
  data_prometida: string | null;
  /** Dias na oficina (tempo de ciclo, key-to-key). */
  diasNaOficina: number;
  /** Dias até o prazo (negativo = estourado). null se sem prazo. */
  diasAtePrazo: number | null;
  saude: SaudePrazo;
};

export type PainelDono = {
  carros: CarroPrazo[];
  kpis: {
    totalAtivos: number;
    noPrazo: number;
    perto: number;
    estourado: number;
    semPrazo: number;
    /** Média de dias na oficina (tempo de ciclo). */
    cicloMedioDias: number;
    /** Ticket médio (média de valor_orcamento dos que têm valor). */
    ticketMedio: number | null;
    /** Soma do valor em produção (carros ativos com orçamento). */
    valorEmProducao: number;
  };
};

/** Forma das linhas vindas da query (mesma seleção no client e no server). */
export type OSRow = {
  id: string;
  placa: string;
  modelo_veiculo: string;
  tipo_cliente: string | null;
  valor_orcamento: number | null;
  data_entrada: string | null;
  data_prometida: string | null;
};

/** Colunas da OS lidas para o painel (única fonte — client e server iguais). */
export const COLS_PAINEL_DONO =
  'id, placa, modelo_veiculo, tipo_cliente, valor_orcamento, data_entrada, data_prometida';

/** Mensagem amigável padrão (mesma higiene do traduzirErro de admin-queries). */
const ERRO_GENERICO = 'Não foi possível carregar o painel. Tente de novo em instantes.';

/**
 * Traduz erros do Postgres/Supabase (ou de catch) para algo legível ao dono.
 * Painel é LEITURA pura — não há jargão de gravação aqui. Nunca devolve o texto
 * cru do banco: o que não casar vira ERRO_GENERICO; mensagens nossas já em
 * PT-BR (timeout do withTimeout) passam intactas. PURA — usada no client e no
 * server (a leitura roda nos dois lados desde o server-move passo 1).
 */
export function traduzirErroDono(msg: string | null | undefined): string {
  if (!msg) return ERRO_GENERICO;
  const m = msg.toLowerCase();
  if (m.includes('conexão demorou') || m.includes('verifique a internet')) return msg;
  if (m.includes('jwt') || m.includes('invalid api key')) {
    return 'Sessão inválida. Faça login de novo.';
  }
  if (m.includes('permission') || m.includes('rls') || m.includes('policy') || m.includes('denied')) {
    return 'Sem permissão para ver o painel. Faça login como dono.';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) {
    return 'Sem conexão com o servidor. Verifique a internet.';
  }
  return ERRO_GENERICO;
}

function diffDias(deISO: string, ateMs: number): number {
  return Math.floor((ateMs - parseISOComUTC(deISO)) / MS_DIA);
}

/**
 * Monta o painel do dono (carros + KPIs, já ordenado por urgência) a partir das
 * linhas de OS ATIVAS. Função PURA: mesma saída para a mesma entrada, sem I/O.
 * É o coração compartilhado entre a leitura client e a server-side.
 */
export function montarPainelDono(rows: OSRow[] | null | undefined): PainelDono {
  const agora = Date.now();
  const carros: CarroPrazo[] = (rows ?? []).map((o) => {
    const diasNaOficina = o.data_entrada ? Math.max(0, diffDias(o.data_entrada, agora)) : 0;
    let diasAtePrazo: number | null = null;
    let saude: SaudePrazo = 'sem_prazo';
    if (o.data_prometida) {
      diasAtePrazo = -diffDias(o.data_prometida, agora); // >0 = ainda há prazo
      saude =
        diasAtePrazo < 0 ? 'estourado' : diasAtePrazo <= DIAS_ALERTA_PRAZO ? 'perto' : 'no_prazo';
    }
    return {
      id: o.id,
      placa: o.placa,
      modelo: o.modelo_veiculo,
      tipo_cliente: o.tipo_cliente,
      valor_orcamento: o.valor_orcamento,
      data_entrada: o.data_entrada,
      data_prometida: o.data_prometida,
      diasNaOficina,
      diasAtePrazo,
      saude,
    };
  });

  const comValor = carros.filter((c) => c.valor_orcamento != null);
  const somaValor = comValor.reduce((acc, c) => acc + (c.valor_orcamento ?? 0), 0);
  const somaCiclo = carros.reduce((acc, c) => acc + c.diasNaOficina, 0);

  const kpis: PainelDono['kpis'] = {
    totalAtivos: carros.length,
    noPrazo: carros.filter((c) => c.saude === 'no_prazo').length,
    perto: carros.filter((c) => c.saude === 'perto').length,
    estourado: carros.filter((c) => c.saude === 'estourado').length,
    semPrazo: carros.filter((c) => c.saude === 'sem_prazo').length,
    cicloMedioDias: carros.length ? Math.round(somaCiclo / carros.length) : 0,
    ticketMedio: comValor.length ? Math.round(somaValor / comValor.length) : null,
    valorEmProducao: somaValor,
  };

  // ordena por urgência: estourado → perto → no_prazo → sem_prazo
  const peso: Record<SaudePrazo, number> = { estourado: 0, perto: 1, no_prazo: 2, sem_prazo: 3 };
  carros.sort(
    (a, b) => peso[a.saude] - peso[b.saude] || (a.diasAtePrazo ?? 999) - (b.diasAtePrazo ?? 999)
  );

  return { carros, kpis };
}

export function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
