/**
 * Painel do DONO — saúde de prazos (Passo 3.5 da ordem A.1).
 *
 * O "holofote" do dono (CLAUDE.md, camada 1): carros dentro do prazo / perto de
 * estourar / estourados, + ticket "dias na oficina × R$ do orçamento". Leitura
 * pura — não escreve nada, não toca no totem nem no RLS.
 *
 * Vocabulário de KPI da pesquisa de domínio (credibilidade com donos):
 *   - Tempo de Ciclo (key-to-key) = "dias na oficina" (data_entrada → hoje).
 *   - Ticket Médio = média de valor_orcamento.
 * NÃO é ROI de hora-homem (esse é fast-follow, fora do MVP): só dados reais,
 * sem fabricar taxas nem um "antes".
 */

import { getSupabase } from './client';
import { parseISOComUTC, type FetchState } from './queries';

const TIMEOUT_MS = 8000;
/** Janela de "perto de estourar": faltam ≤ N dias para o prazo. */
export const DIAS_ALERTA_PRAZO = 3;
const MS_DIA = 24 * 60 * 60 * 1000;

function withTimeout<T>(promise: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Conexão demorou demais. Verifique a internet e tente de novo.'));
    }, ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
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

type OSRow = {
  id: string;
  placa: string;
  modelo_veiculo: string;
  tipo_cliente: string | null;
  valor_orcamento: number | null;
  data_entrada: string | null;
  data_prometida: string | null;
};

function diffDias(deISO: string, ateMs: number): number {
  return Math.floor((ateMs - parseISOComUTC(deISO)) / MS_DIA);
}

/** Monta o painel do dono a partir das OS ativas (não entregues). */
export async function carregarPainelDono(): Promise<FetchState<PainelDono>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('ordens_servico')
        .select(
          'id, placa, modelo_veiculo, tipo_cliente, valor_orcamento, data_entrada, data_prometida'
        )
        .neq('status_geral', 'Entregue')
        .order('data_prometida', { ascending: true, nullsFirst: false })
    );
    const { data, error } = result as { data: OSRow[] | null; error: { message: string } | null };
    if (error) return { status: 'error', message: error.message };

    const agora = Date.now();
    const carros: CarroPrazo[] = (data ?? []).map((o) => {
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
    carros.sort((a, b) => peso[a.saude] - peso[b.saude] || (a.diasAtePrazo ?? 999) - (b.diasAtePrazo ?? 999));

    return { status: 'success', data: { carros, kpis } };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

export function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
