/**
 * Visão Operacional AO VIVO — LEITURA no SERVIDOR (versão server-side).
 * Server-move passo 1.
 *
 * O kanban do Daily Huddle (CLAUDE.md) sai do browser e roda aqui, num Server
 * Component. Diferenças vs a versão client (live-queries.ts):
 *   - o cliente Supabase vem do DAL (getServerClient), JÁ AUTENTICADO pela sessão
 *     do COOKIE httpOnly → o RLS isola por oficina_id SEM nenhum filtro manual;
 *   - o oficina_id NUNCA vem do cliente: quem isola é o RLS + a sessão verificada
 *     (REGRA DE OURO do DAL). Nunca filtramos oficina_id no código.
 *
 * O que é PRESERVADO, idêntico à versão client:
 *   - o contrato FetchState<T> (loading/success/empty/error);
 *   - o timeout de 8s (withTimeout) — nenhuma leitura trava o render para sempre;
 *   - a MESMA seleção de colunas (COLS_*_LIVE) e os MESMOS filtros/ordens;
 *   - a MESMA regra de negócio (montarVisaoLive + excluirCorrigidos, de
 *     live-shared.ts) — zero cópia;
 *   - a MESMA robustez §4: se a checagem da trilha de correções falhar, mantém os
 *     ativos como estão (conservador) e avisa no log — pior caso, um fantasma já
 *     corrigido reaparece (o admin recorrige), melhor que cegar o painel.
 *
 * Esta é uma tela SÓ LEITURA: não há escrita (arrastar/corrigir etapa) nesta tela
 * — a edição de etapa_atual vive no formulário da OS (/admin/os). O auto-refresh
 * (mesma cadência de 20s) re-roda este Server Component via router.refresh() na
 * View — sem query Supabase no Network do browser para LER.
 *
 * Sem sessão (cookie ausente/expirado — ex.: 1º render antes do login) NÃO é erro
 * nem redirect: devolvemos `empty` e o AdminAuthGate (client) mostra a tela de
 * login. A query nunca roda sem sessão, então o anon não lê nada aqui.
 */

import 'server-only';

import { getServerClient, sessaoGestorOuNull } from './dal';
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
  type VisaoLive,
} from './live-shared';

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
 * Monta a visão ao vivo completa numa tirada só, LENDO NO SERVIDOR com a sessão
 * do cookie. RLS isola por oficina_id automaticamente. Faz poucas queries amplas
 * e cruza no shared (puro) — barato para a escala de uma oficina (dezenas de linhas).
 */
export async function carregarVisaoLiveServer(): Promise<FetchState<VisaoLive>> {
  // Sem sessão verificada → não consulta (evita ler como anon) e deixa o gate
  // client cuidar do login. Não é erro: é o estado "ainda não logado".
  const sessao = await sessaoGestorOuNull();
  if (!sessao) return { status: 'empty' };

  try {
    const sb = await getServerClient();
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
      console.warn('[carregarVisaoLiveServer] falha na carga principal:', erro.message);
      return { status: 'error', message: MSG_FALHA_LIVE };
    }

    const oss = ((osRes as { data: OSRowLive[] | null }).data ?? []) as OSRowLive[];
    const apontBruto = ((apRes as { data: ApontRowLive[] | null }).data ?? []) as ApontRowLive[];
    const apHoje = ((apHojeRes as { data: ApontHojeRowLive[] | null }).data ??
      []) as ApontHojeRowLive[];

    // §4 (correção append-only): o bruto segue 'Em andamento'/'Pausado' de
    // propósito (imutável). Um apontamento com correção ENCERRANTE
    // (ajustar_fim/descartar) na trilha já não é ativo — então o LEITOR o exclui.
    // Sem isso, um fantasma corrigido reapareceria como "produzindo" na faixa e
    // como apontamento ativo no card do kanban. Mesma regra de listarAnomalias.
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
      // ROBUSTEZ (igual à versão client): se a checagem de correções falhar, NÃO
      // derrubar a visão inteira pra 'error' — apenas não exclui ninguém (mostra
      // os ativos como estão). No pior caso, um fantasma já corrigido reaparece (o
      // admin recorrige), muito melhor que cegar o painel por uma falha auxiliar.
      if (corrErr) {
        console.warn(
          '[carregarVisaoLiveServer] falha ao checar correções (ignorada):',
          corrErr.message
        );
      } else {
        apont = excluirCorrigidos(apontBruto, corrRows);
      }
    }

    return { status: 'success', data: montarVisaoLive(oss, apont, apHoje) };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
