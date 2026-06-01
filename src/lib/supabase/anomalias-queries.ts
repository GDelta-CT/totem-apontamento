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
    if (error) return { status: 'error', message: error.message };

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
    return { status: 'success', data: anomalias };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

/** Traduz erro de gravação para algo legível ao admin. */
function traduzirErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('permission') || m.includes('denied') || m.includes('row-level')) {
    return 'Sem permissão para corrigir. (Falta aplicar a Migration 006 de grants no teste.)';
  }
  if (m.includes('editado_admin')) {
    return 'Coluna de marca ausente. (Falta aplicar a Migration 006 no teste.)';
  }
  return msg;
}

/**
 * Fecha um apontamento fantasma: marca como Finalizado, define hora_fim e a
 * marca "editado pelo admin". Só funciona após a Migration 006.
 */
export async function fecharApontamento(
  id: string,
  horaFimISO?: string
): Promise<FetchState<true>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .update({
          status_tarefa: 'Finalizado',
          hora_fim: horaFimISO ?? new Date().toISOString(),
          editado_admin: true,
        })
        .eq('id', id)
        .select('id')
        .single()
    );
    const { error } = result as { error: { message: string } | null };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    return { status: 'success', data: true };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
