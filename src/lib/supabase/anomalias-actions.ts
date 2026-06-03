'use server';

/**
 * Server Actions de ANOMALIAS — CORREÇÃO no SERVIDOR (server-move, Passo 3).
 *
 * Move a ESCRITA da correção de /admin/anomalias do browser para o servidor.
 * Antes, a View chamava registrarCorrecao() (getSupabase no cliente). Agora chama
 * esta Server Action, e a gravação roda no servidor com a sessão do COOKIE httpOnly.
 *
 * A correção é APPEND-ONLY (docs/PLANO-CORRECAO-ANOMALIA): NÃO sobrescreve o bruto
 * (hora_inicio/hora_fim/status). Registra UMA linha em apontamento_correcoes
 * (antes→depois, motivo OBRIGATÓRIO, quem/quando pelo servidor) e marca
 * editado_admin=true (só marcador). Os leitores (listarAnomaliasServer) excluem os
 * apontamentos com correção encerrante.
 *
 * Como TODA Server Action é um endpoint PÚBLICO (POST direto, não só pela UI), a
 * action:
 *   1) chama requireGestor() PRIMEIRO — revalida no servidor que quem corrige é
 *      dono/gerente. requireGestor() LANÇA para papel insuficiente
 *      (GDELTA_FORBIDDEN); capturamos e devolvemos erro amigável (a action NUNCA
 *      estoura pro cliente). Sem sessão, requireGestor() faz redirect('/admin');
 *   2) usa o cliente do DAL (getServerClient) — JÁ autenticado pelo cookie, então
 *      o RLS isola por oficina_id e o trigger BEFORE INSERT carimba o oficina_id na
 *      linha de correção. NUNCA mandamos oficina_id do cliente;
 *   3) retorna FetchState<true>, preservando as MESMAS mensagens amigáveis
 *      (traduzirErroAnomalia) e o MESMO timeout de 8s da versão client;
 *   4) no sucesso, revalida /admin/anomalias para o Server Component re-ler. A View
 *      também dá router.refresh() (mantido) — a tela atualiza após a ação como antes.
 *
 * SOBRE GRAVAR DE VERDADE: a correção só persiste após a Migration de grants
 * (UPDATE em apontamentos + INSERT em apontamento_correcoes) e com gestor logado.
 * Até lá, o RLS recusa e a action devolve a mensagem de permissão — é o esperado.
 */

import { revalidatePath } from 'next/cache';

import { getServerClient, requireGestor } from './dal';
import type { FetchState } from './queries';
import {
  traduzirErroAnomalia,
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
 * Correção APPEND-ONLY de um apontamento-fantasma (server). NÃO sobrescreve o
 * bruto: registra UMA linha em apontamento_correcoes (antes→depois) e marca
 * editado_admin=true. No sucesso, revalida /admin/anomalias.
 *
 * Comportamento idêntico à versão client (registrarCorrecao): mesmas etapas
 * (snapshot do "antes" → INSERT na trilha → marca o apontamento), mesmas mensagens
 * (traduzirErroAnomalia), mesmo timeout. A diferença é só ONDE roda (servidor) e a
 * barreira de gestor no início.
 */
export async function registrarCorrecao(params: {
  apontamentoId: string;
  acao: AcaoCorrecao;
  motivo: string;
  motivoCodigo?: MotivoCodigo;
  horaFimISO?: string;
}): Promise<FetchState<true>> {
  // 1) Barreira de gestor (endpoint público). Papel insuficiente vira erro amigável
  //    no idioma de anomalias; o redirect (sem sessão) é controle de fluxo do Next.
  try {
    await requireGestor();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('GDELTA_FORBIDDEN')) {
      return { status: 'error', message: traduzirErroAnomalia('permission denied') };
    }
    throw e; // NEXT_REDIRECT e afins: re-lança para o framework concluir.
  }

  const motivo = params.motivo.trim();
  if (!motivo) return { status: 'error', message: 'Informe o motivo da correção.' };
  try {
    const supabase = await getServerClient();

    // 2) Snapshot do "antes" — o bruto NUNCA é sobrescrito.
    const atual = await withTimeout(
      supabase
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

    // 3) O "depois": ajustar_fim encerra com um fim efetivo; descartar não tem depois.
    const valorCorrigido =
      params.acao === 'ajustar_fim'
        ? { status_tarefa: 'Finalizado', hora_fim: params.horaFimISO ?? new Date().toISOString() }
        : params.acao === 'confirmar'
          ? { status_tarefa: bruto.status_tarefa }
          : null;

    // 4) Acréscimo na trilha (oficina_id pelo trigger; admin_user_id/corrigido_em pelo default).
    const ins = await withTimeout(
      supabase
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

    // 5) Marca "editado pelo admin" (apenas marcador; tempos/status do bruto intactos).
    await withTimeout(
      supabase.from('apontamentos').update({ editado_admin: true }).eq('id', params.apontamentoId)
    );

    revalidatePath('/admin/anomalias');
    return { status: 'success', data: true };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
