/**
 * Camada de dados da VISÃO OPERACIONAL AO VIVO — leitura no BROWSER (versão client).
 *
 * Responde às 2 perguntas do dono (CLAUDE.md):
 *   1. "Todo mundo está produzindo agora?"  -> os 3 estados do operário.
 *   2. "Que carro está travado/lento?"      -> kanban por etapa + bloqueios.
 *
 * SERVER-MOVE (passo 1): a regra de negócio (agrupar apontamentos por OS, montar
 * carros/colunas/estados, excluir fantasmas corrigidos) e os tipos saíram daqui
 * para live-shared.ts (módulo PURO, sem Supabase), e a versão server-side da
 * LEITURA vive em live-queries.server.ts (RSC + DAL). Este arquivo continua
 * existindo para quem AINDA lê do browser — re-exporta tipos/constantes
 * compartilhados para NÃO quebrar nenhum import já existente. A tela de produção
 * passou a LER do servidor; este carregarVisaoLive() segue disponível para usos
 * client (e mantém o comportamento idêntico ao original).
 *
 * Leitura pura: lê dados que o totem já grava (apontamentos, ordens_servico). Não
 * escreve nada, não toca no totem nem no RLS. Tempos ancorados no servidor
 * (hora_inicio / registrado_em vêm do banco).
 */

import { getSupabase } from './client';
import type { FetchState } from './queries';
import {
  ACOES_ENCERRANTES_LIVE,
  COLS_APONT_HOJE_LIVE,
  COLS_APONT_LIVE,
  COLS_OS_LIVE,
  MSG_FALHA_LIVE,
  STATUS_ATIVOS_LIVE,
  excluirCorrigidos,
  inicioDeHojeISO,
  montarVisaoLive,
  type ApontHojeRowLive,
  type ApontRowLive,
  type OSRowLive,
} from './live-shared';

// Re-export do núcleo compartilhado: preserva o contrato de quem importava estes
// nomes de './live-queries' (ESTADO_LABEL e os tipos CarroLive/VisaoLive/
// EstadoOperario/OperarioLive/ApontamentoAtivo). A UI segue importando daqui.
export {
  ESTADO_LABEL,
  type ApontamentoAtivo,
  type CarroLive,
  type EstadoOperario,
  type OperarioLive,
  type VisaoLive,
} from './live-shared';

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

/**
 * Monta a visão ao vivo completa numa tirada só. VERSÃO CLIENT (lê do browser).
 * Faz poucas queries amplas e cruza no shared (puro) — barato para a escala de
 * uma oficina (dezenas de linhas). Reusa a regra pura de live-shared.ts — sem
 * cópia da versão server.
 */
export async function carregarVisaoLive(): Promise<FetchState<import('./live-shared').VisaoLive>> {
  try {
    const sb = getSupabase();
    const hoje = inicioDeHojeISO();

    const [osRes, apRes, apHojeRes] = await Promise.all([
      withTimeout(
        sb
          .from('ordens_servico')
          .select(COLS_OS_LIVE)
          .neq('status_geral', 'Entregue')
          .order('data_entrada', { ascending: true })
      ),
      withTimeout(
        sb
          .from('apontamentos')
          .select(COLS_APONT_LIVE)
          .in('status_tarefa', [...STATUS_ATIVOS_LIVE])
          .order('hora_inicio', { ascending: false })
      ),
      // apontamentos de HOJE (qualquer status) -> quem trabalhou hoje (p/ "sem tarefa ativa")
      withTimeout(
        sb
          .from('apontamentos')
          .select(COLS_APONT_HOJE_LIVE)
          .gte('hora_inicio', hoje)
          .order('hora_inicio', { ascending: false })
      ),
    ]);

    const erro =
      (osRes as { error: { message: string } | null }).error ||
      (apRes as { error: { message: string } | null }).error ||
      (apHojeRes as { error: { message: string } | null }).error;
    if (erro) {
      console.warn('[carregarVisaoLive] falha na carga principal:', erro.message);
      return { status: 'error', message: MSG_FALHA_LIVE };
    }

    const oss = ((osRes as { data: OSRowLive[] | null }).data ?? []) as OSRowLive[];
    const apontBruto = ((apRes as { data: ApontRowLive[] | null }).data ?? []) as ApontRowLive[];
    const apHoje = ((apHojeRes as { data: ApontHojeRowLive[] | null }).data ??
      []) as ApontHojeRowLive[];

    // §4 (correção append-only): exclui apontamentos com correção ENCERRANTE
    // (ajustar_fim/descartar) na trilha — sem isso um fantasma corrigido
    // reapareceria como "produzindo". Mesma regra de listarAnomalias.
    let apont = apontBruto;
    if (apontBruto.length > 0) {
      const ids = apontBruto.map((a) => a.id);
      const corr = await withTimeout(
        sb
          .from('apontamento_correcoes')
          .select('apontamento_id')
          .in('apontamento_id', ids)
          .in('acao', [...ACOES_ENCERRANTES_LIVE])
      );
      const { data: corrRows, error: corrErr } = corr as {
        data: { apontamento_id: string }[] | null;
        error: { message: string } | null;
      };
      // ROBUSTEZ: se a checagem de correções falhar, NÃO derrubar a visão inteira
      // pra 'error' — apenas não exclui ninguém (mostra os ativos como estão).
      if (corrErr) {
        console.warn('[carregarVisaoLive] falha ao checar correções (ignorada):', corrErr.message);
      } else {
        apont = excluirCorrigidos(apontBruto, corrRows);
      }
    }

    return { status: 'success', data: montarVisaoLive(oss, apont, apHoje) };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
