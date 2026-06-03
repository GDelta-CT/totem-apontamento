/**
 * Detecção e correção de ANOMALIAS de apontamento (Passo 4 da ordem A.1).
 *
 * A DETECÇÃO é leitura pura. A CORREÇÃO (editar tempo / fechar fantasma) só grava
 * de verdade após a Migration 006 (grants de UPDATE em apontamentos) ser aplicada
 * no teste — até lá, retorna erro de permissão, tratado de forma amigável na UI.
 *
 * SERVER-MOVE (passo 1): a regra de negócio (classificar fantasmas, calcular
 * horas, excluir os já corrigidos) e os tipos saíram daqui para anomalias-shared.ts
 * (módulo PURO, sem Supabase), e a versão server-side da LEITURA vive em
 * anomalias-queries.server.ts (RSC + DAL).
 *
 * SERVER-MOVE (passo 3): a ESCRITA (registrarCorrecao) foi MOVIDA para o servidor
 * em anomalias-actions.ts (Server Action com requireGestor + RLS). A tela de
 * anomalias passou a chamar a Action. O registrarCorrecao CLIENT abaixo NÃO é mais
 * chamado pela View; fica aqui preservado para não quebrar o contrato/histórico (a
 * versão server é a gêmea exata). Este arquivo segue para quem AINDA lê do browser
 * (listarAnomalias) e RE-EXPORTA tipos/constantes para NÃO quebrar imports.
 *
 * Teto anti-fantasma (CLAUDE.md): apontamento ativo muito acima de ~10,5h é
 * anomalia para o admin corrigir. Tempos ancorados no relógio do servidor.
 */

import { getSupabase } from './client';
import type { FetchState } from './queries';
import {
  ACOES_ENCERRANTES,
  COLS_ANOMALIAS,
  MSG_FALHA_LEITURA,
  STATUS_ATIVOS,
  filtrarCorrigidas,
  montarAnomalias,
  traduzirErroAnomalia,
  type RowAnomalia,
} from './anomalias-shared';

// Re-export do núcleo compartilhado: preserva o contrato de quem importava estes
// nomes de './anomalias-queries' (TETO_FANTASMA_MS, tipos Anomalia/AcaoCorrecao/
// MotivoCodigo). Os testes e a UI seguem importando daqui sem mudança.
export {
  TETO_FANTASMA_MS,
  type Anomalia,
  type AcaoCorrecao,
  type MotivoCodigo,
} from './anomalias-shared';

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
 * Lista apontamentos ATIVOS (Em andamento/Pausado) abertos há mais que o teto
 * anti-fantasma. VERSÃO CLIENT (lê do browser). Reusa a regra pura de
 * anomalias-shared.ts — sem cópia da versão server.
 */
export async function listarAnomalias(): Promise<FetchState<import('./anomalias-shared').Anomalia[]>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .select(COLS_ANOMALIAS)
        .in('status_tarefa', [...STATUS_ATIVOS])
        .order('hora_inicio', { ascending: true })
    );
    const { data, error } = result as { data: RowAnomalia[] | null; error: { message: string } | null };
    if (error) {
      console.warn('[listarAnomalias] falha na consulta principal:', error.message);
      return { status: 'error', message: MSG_FALHA_LEITURA };
    }

    const anomalias = montarAnomalias(data, Date.now());
    if (anomalias.length === 0) return { status: 'empty' };

    // §4 (PLANO): não ressuscitar fantasmas já corrigidos — exclui apontamentos
    // com correção encerrante (ajustar_fim/descartar) na trilha.
    const ids = anomalias.map((a) => a.id);
    const corr = await withTimeout(
      getSupabase()
        .from('apontamento_correcoes')
        .select('apontamento_id')
        .in('apontamento_id', ids)
        .in('acao', [...ACOES_ENCERRANTES])
    );
    const { data: corrRows, error: corrErr } = corr as {
      data: { apontamento_id: string }[] | null;
      error: { message: string } | null;
    };
    // ROBUSTEZ: se a checagem da trilha falhar, mantemos a lista SEM excluir
    // (conservador) e avisamos no log. Pior caso: um fantasma já corrigido
    // reaparece como anomalia (o admin recorrige) — preferível a sumir com
    // anomalias por uma falha auxiliar.
    if (corrErr) {
      console.warn('[listarAnomalias] falha ao checar correções (ignorada):', corrErr.message);
      return { status: 'success', data: anomalias };
    }
    const restantes = filtrarCorrigidas(anomalias, corrRows);

    if (restantes.length === 0) return { status: 'empty' };
    return { status: 'success', data: restantes };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

/**
 * Correção APPEND-ONLY de um apontamento-fantasma (docs/PLANO-CORRECAO-ANOMALIA).
 * NÃO sobrescreve o bruto (hora_inicio/hora_fim/status): registra UMA linha em
 * apontamento_correcoes (antes→depois, motivo OBRIGATÓRIO, quem/quando pelo
 * servidor) e marca editado_admin=true (só marcador). Os leitores excluem os
 * apontamentos com correção encerrante (ver listarAnomalias / §4 do plano).
 *
 * ESCRITA — segue no cliente neste passo (Passo 3 do server-move move escrita).
 */
export async function registrarCorrecao(params: {
  apontamentoId: string;
  acao: import('./anomalias-shared').AcaoCorrecao;
  motivo: string;
  motivoCodigo?: import('./anomalias-shared').MotivoCodigo;
  horaFimISO?: string;
}): Promise<FetchState<true>> {
  const motivo = params.motivo.trim();
  if (!motivo) return { status: 'error', message: 'Informe o motivo da correção.' };
  try {
    // 1) Snapshot do "antes" — o bruto NUNCA é sobrescrito.
    const atual = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .select('hora_inicio, hora_fim, status_tarefa, etapa')
        .eq('id', params.apontamentoId)
        .single()
    );
    const { data: bruto, error: e1 } = atual as {
      data: {
        hora_inicio: string;
        hora_fim: string | null;
        status_tarefa: string;
        etapa: string | null;
      } | null;
      error: { message: string } | null;
    };
    if (e1) return { status: 'error', message: traduzirErroAnomalia(e1.message) };
    if (!bruto) return { status: 'error', message: 'Apontamento não encontrado.' };

    // 2) O "depois": ajustar_fim encerra com um fim efetivo; descartar não tem depois.
    const valorCorrigido =
      params.acao === 'ajustar_fim'
        ? { status_tarefa: 'Finalizado', hora_fim: params.horaFimISO ?? new Date().toISOString() }
        : params.acao === 'confirmar'
          ? { status_tarefa: bruto.status_tarefa }
          : null;

    // 3) Acréscimo na trilha (oficina_id pelo trigger; admin_user_id/corrigido_em pelo default).
    const ins = await withTimeout(
      getSupabase()
        .from('apontamento_correcoes')
        .insert({
          apontamento_id: params.apontamentoId,
          acao: params.acao,
          valor_original: {
            hora_inicio: bruto.hora_inicio,
            hora_fim: bruto.hora_fim,
            status_tarefa: bruto.status_tarefa,
            etapa: bruto.etapa,
          },
          valor_corrigido: valorCorrigido,
          motivo,
          motivo_codigo: params.motivoCodigo ?? null,
        })
        .select('id')
        .single()
    );
    const { error: e2 } = ins as { error: { message: string } | null };
    if (e2) return { status: 'error', message: traduzirErroAnomalia(e2.message) };

    // 4) Marca "editado pelo admin" (apenas marcador; tempos/status do bruto intactos).
    await withTimeout(
      getSupabase()
        .from('apontamentos')
        .update({ editado_admin: true })
        .eq('id', params.apontamentoId)
    );

    return { status: 'success', data: true };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
