/**
 * Detecção e correção de ANOMALIAS de apontamento (Passo 4 da ordem A.1).
 *
 * A DETECÇÃO é leitura pura (funciona já). A CORREÇÃO (editar tempo / fechar
 * fantasma) só grava de verdade após a Migration 006 (grants de UPDATE em
 * apontamentos) ser aplicada no teste — até lá, retorna erro de permissão,
 * tratado de forma amigável na UI.
 *
 * Teto anti-fantasma (CLAUDE.md): apontamento ativo muito acima de ~10,5h é
 * anomalia para o admin corrigir. Tempos ancorados no relógio do servidor.
 */

import { getSupabase } from './client';
import { parseISOComUTC, type FetchState } from './queries';

const TIMEOUT_MS = 8000;
/** Teto anti-fantasma: 10,5h em milissegundos. */
export const TETO_FANTASMA_MS = 10.5 * 60 * 60 * 1000;

// Higiene (#7): a LEITURA nunca expõe erro cru do Postgres (RLS/SQL/estrutura) na UI.
const MSG_FALHA_LEITURA = 'Não foi possível carregar as anomalias agora. Tente de novo.';

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

type Row = {
  id: string;
  nome_funcionario: string;
  cargo_funcionario: string | null;
  etapa: string | null;
  status_tarefa: string;
  hora_inicio: string;
  ordem_servico: { placa: string; modelo_veiculo: string } | { placa: string; modelo_veiculo: string }[] | null;
};

/**
 * Lista apontamentos ATIVOS (Em andamento/Pausado) abertos há mais que o teto
 * anti-fantasma. São candidatos a correção do admin (fechar/ajustar).
 */
export async function listarAnomalias(): Promise<FetchState<Anomalia[]>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .select(
          'id, nome_funcionario, cargo_funcionario, etapa, status_tarefa, hora_inicio, ordem_servico:ordens_servico(placa, modelo_veiculo)'
        )
        .in('status_tarefa', ['Em andamento', 'Pausado'])
        .order('hora_inicio', { ascending: true })
    );
    const { data, error } = result as { data: Row[] | null; error: { message: string } | null };
    if (error) {
      console.warn('[listarAnomalias] falha na consulta principal:', error.message);
      return { status: 'error', message: MSG_FALHA_LEITURA };
    }

    const agora = Date.now();
    const anomalias: Anomalia[] = (data ?? [])
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

    if (anomalias.length === 0) return { status: 'empty' };

    // §4 (PLANO): não ressuscitar fantasmas já corrigidos — exclui apontamentos
    // com correção encerrante (ajustar_fim/descartar) na trilha.
    const ids = anomalias.map((a) => a.id);
    const corr = await withTimeout(
      getSupabase()
        .from('apontamento_correcoes')
        .select('apontamento_id')
        .in('apontamento_id', ids)
        .in('acao', ['ajustar_fim', 'descartar'])
    );
    const { data: corrRows, error: corrErr } = corr as {
      data: { apontamento_id: string }[] | null;
      error: { message: string } | null;
    };
    // ROBUSTEZ: antes o erro era IGNORADO em silêncio (corrRows null) -> a exclusão
    // não acontecia, mas calada. Agora desestruturamos o erro: se a checagem da
    // trilha falhar, mantemos a lista de anomalias SEM excluir (conservador) e
    // avisamos no log. Pior caso: um fantasma já corrigido reaparece como anomalia
    // (o admin recorrige) — preferível a sumir com anomalias por uma falha auxiliar.
    if (corrErr) {
      console.warn('[listarAnomalias] falha ao checar correções (ignorada):', corrErr.message);
      return { status: 'success', data: anomalias };
    }
    const encerrados = new Set((corrRows ?? []).map((c) => c.apontamento_id));
    const restantes = anomalias.filter((a) => !encerrados.has(a.id));

    if (restantes.length === 0) return { status: 'empty' };
    return { status: 'success', data: restantes };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

/** Traduz erro de gravação para algo legível ao admin (sem jargão técnico). */
function traduzirErro(msg: string): string {
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

export type AcaoCorrecao = 'ajustar_fim' | 'descartar' | 'confirmar';
export type MotivoCodigo = 'esqueceu_parar' | 'saiu_sem_registrar' | 'erro_toque' | 'outro';

/**
 * Correção APPEND-ONLY de um apontamento-fantasma (docs/PLANO-CORRECAO-ANOMALIA).
 * NÃO sobrescreve o bruto (hora_inicio/hora_fim/status): registra UMA linha em
 * apontamento_correcoes (antes→depois, motivo OBRIGATÓRIO, quem/quando pelo
 * servidor) e marca editado_admin=true (só marcador). Os leitores excluem os
 * apontamentos com correção encerrante (ver listarAnomalias / §4 do plano).
 */
export async function registrarCorrecao(params: {
  apontamentoId: string;
  acao: AcaoCorrecao;
  motivo: string;
  motivoCodigo?: MotivoCodigo;
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
    if (e1) return { status: 'error', message: traduzirErro(e1.message) };
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
    if (e2) return { status: 'error', message: traduzirErro(e2.message) };

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
