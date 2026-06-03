/**
 * Painel do DONO — leitura no BROWSER (versão client).
 *
 * O "holofote" do dono (CLAUDE.md, camada 1): carros dentro do prazo / perto de
 * estourar / estourados, + ticket "dias na oficina × R$ do orçamento". Leitura
 * pura — não escreve nada, não toca no totem nem no RLS.
 *
 * SERVER-MOVE (passo 1): a regra de negócio (cálculo de KPIs, saúde de prazo,
 * ordenação) saiu daqui para dono-shared.ts (módulo PURO, sem Supabase), e a
 * versão server-side vive em dono-queries.server.ts (RSC + DAL). Este arquivo
 * continua existindo para quem AINDA lê do browser — re-exporta os tipos/utils
 * compartilhados para NÃO quebrar nenhum import já existente. A tela de prazos
 * passou a usar a versão server; outras telas/usos client seguem chamando
 * carregarPainelDono() daqui igual a antes.
 *
 * Vocabulário de KPI da pesquisa de domínio (credibilidade com donos):
 *   - Tempo de Ciclo (key-to-key) = "dias na oficina" (data_entrada → hoje).
 *   - Ticket Médio = média de valor_orcamento.
 * NÃO é ROI de hora-homem (esse é fast-follow, fora do MVP): só dados reais,
 * sem fabricar taxas nem um "antes".
 */

import { getSupabase } from './client';
import type { FetchState } from './queries';
import {
  COLS_PAINEL_DONO,
  montarPainelDono,
  traduzirErroDono,
  type OSRow,
  type PainelDono,
} from './dono-shared';

// Re-export do núcleo compartilhado: preserva o contrato de quem importava
// estes nomes de './dono-queries' (brl, DIAS_ALERTA_PRAZO, traduzirErroDono, tipos).
export {
  brl,
  DIAS_ALERTA_PRAZO,
  traduzirErroDono,
  type CarroPrazo,
  type PainelDono,
  type SaudePrazo,
} from './dono-shared';

const TIMEOUT_MS = 8000;

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

/** Monta o painel do dono a partir das OS ativas (não entregues). VERSÃO CLIENT. */
export async function carregarPainelDono(): Promise<FetchState<PainelDono>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('ordens_servico')
        .select(COLS_PAINEL_DONO)
        .neq('status_geral', 'Entregue')
        .order('data_prometida', { ascending: true, nullsFirst: false })
    );
    const { data, error } = result as { data: OSRow[] | null; error: { message: string } | null };
    if (error) return { status: 'error', message: traduzirErroDono(error.message) };

    return { status: 'success', data: montarPainelDono(data) };
  } catch (e) {
    return { status: 'error', message: traduzirErroDono(e instanceof Error ? e.message : null) };
  }
}
