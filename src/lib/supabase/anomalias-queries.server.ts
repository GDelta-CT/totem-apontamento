/**
 * Anomalias — LEITURA no SERVIDOR (versão server-side). Server-move passo 1.
 *
 * A DETECÇÃO de apontamentos-fantasma (ativos além do teto de ~10,5h) sai do
 * browser e roda aqui, num Server Component. Diferenças vs a versão client
 * (anomalias-queries.ts):
 *   - o cliente Supabase vem do DAL (getServerClient), JÁ AUTENTICADO pela sessão
 *     do COOKIE httpOnly → o RLS isola por oficina_id SEM nenhum filtro manual;
 *   - o oficina_id NUNCA vem do cliente: quem isola é o RLS + a sessão verificada
 *     (REGRA DE OURO do DAL).
 *
 * O que é PRESERVADO, idêntico à versão client:
 *   - o contrato FetchState<T> (loading/success/empty/error);
 *   - o timeout de 8s (withTimeout) — nenhuma leitura trava o render para sempre;
 *   - a MESMA seleção de colunas (COLS_ANOMALIAS) e o MESMO filtro/ordem;
 *   - a MESMA regra de negócio (montarAnomalias + filtrarCorrigidas, de
 *     anomalias-shared.ts) — zero cópia;
 *   - a MESMA robustez: se a checagem da trilha de correções falhar, mantém a
 *     lista SEM excluir (conservador) e avisa no log.
 *
 * A CORREÇÃO (escrita) continua no CLIENTE neste passo (Passo 3 move escrita):
 * a View chama registrarCorrecao() de anomalias-queries.ts e, no sucesso, dá
 * router.refresh() para o Server Component re-ler aqui.
 *
 * Sem sessão (cookie ausente/expirado — ex.: 1º render antes do login) NÃO é erro
 * nem redirect: devolvemos `empty` e o AdminAuthGate (client) mostra a tela de
 * login. A query nunca roda sem sessão, então o anon não lê nada aqui.
 */

import 'server-only';

import { getServerClient, sessaoGestorOuNull } from './dal';
import type { FetchState } from './queries';
import {
  ACOES_ENCERRANTES,
  COLS_ANOMALIAS,
  MSG_FALHA_LEITURA,
  STATUS_ATIVOS,
  filtrarCorrigidas,
  montarAnomalias,
  type Anomalia,
  type RowAnomalia,
} from './anomalias-shared';

const TIMEOUT_MS = 8000;

/** Mesmo guarda-chuva de timeout da versão client: nenhuma leitura é eterna. */
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
 * anti-fantasma, LENDO NO SERVIDOR com a sessão do cookie. RLS isola por
 * oficina_id automaticamente. São candidatos a correção do admin (fechar/ajustar).
 */
export async function listarAnomaliasServer(): Promise<FetchState<Anomalia[]>> {
  // Sem sessão verificada → não consulta (evita ler como anon) e deixa o gate
  // client cuidar do login. Não é erro: é o estado "ainda não logado".
  const sessao = await sessaoGestorOuNull();
  if (!sessao) return { status: 'empty' };

  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('apontamentos')
        .select(COLS_ANOMALIAS)
        .in('status_tarefa', [...STATUS_ATIVOS])
        .order('hora_inicio', { ascending: true })
    );
    const { data, error } = result as { data: RowAnomalia[] | null; error: { message: string } | null };
    if (error) {
      console.warn('[listarAnomaliasServer] falha na consulta principal:', error.message);
      return { status: 'error', message: MSG_FALHA_LEITURA };
    }

    const anomalias = montarAnomalias(data, Date.now());
    if (anomalias.length === 0) return { status: 'empty' };

    // §4 (PLANO): não ressuscitar fantasmas já corrigidos — exclui apontamentos
    // com correção encerrante (ajustar_fim/descartar) na trilha.
    const ids = anomalias.map((a) => a.id);
    const corr = await withTimeout(
      supabase
        .from('apontamento_correcoes')
        .select('apontamento_id')
        .in('apontamento_id', ids)
        .in('acao', [...ACOES_ENCERRANTES])
    );
    const { data: corrRows, error: corrErr } = corr as {
      data: { apontamento_id: string }[] | null;
      error: { message: string } | null;
    };
    // ROBUSTEZ (igual à versão client): se a checagem da trilha falhar, mantemos
    // a lista SEM excluir (conservador) e avisamos no log. Pior caso: um fantasma
    // já corrigido reaparece como anomalia (o admin recorrige) — preferível a
    // sumir com anomalias por uma falha auxiliar.
    if (corrErr) {
      console.warn('[listarAnomaliasServer] falha ao checar correções (ignorada):', corrErr.message);
      return { status: 'success', data: anomalias };
    }

    const restantes = filtrarCorrigidas(anomalias, corrRows);
    if (restantes.length === 0) return { status: 'empty' };
    return { status: 'success', data: restantes };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
